/**
 * sync.ts - 로컬 SQLite ↔ Supabase 동기화 엔진
 *
 * 아키텍처: Offline-First
 * - 모든 UI 작업은 로컬 SQLite에 즉시 기록
 * - 백그라운드에서 30초마다 Supabase와 동기화
 * - 충돌 해결 전략: Last-Write-Wins (updated_at 기준)
 */

import net from 'net';
import { getDb } from './database';
import { getSupabaseClient, isSupabaseConfigured, getSession } from './supabase';

// ─── 타입 정의 ─────────────────────────────────────────────────────────────

interface SyncMeta {
  table_name: string;
  local_id: number;
  remote_id: string | null;
  last_synced_at: string | null;
  is_dirty: number;
  is_deleted: number;
}

interface SyncStatus {
  lastSyncedAt: string | null;
  pendingChanges: number;
  isOnline: boolean;
  isSyncing: boolean;
}

// 로컬 테이블별 행 타입 (sync에서 필요한 최소 필드)
interface SettingsRow {
  id: number;
  resignation_date: string;
  runway_months: number;
  start_date: string | null;
  player_name: string;
  level: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  updated_at: string;
}

interface QuestRow {
  id: number;
  category: string;
  title: string;
  description: string;
  completed: number;
  progress: number;
  sort_order: number;
  difficulty: string;
  xp: number;
  deadline: string | null;
  completed_at: string | null;
  updated_at: string;
}

interface MilestoneRow {
  id: number;
  quest_id: number;
  title: string;
  completed: number;
  sort_order: number;
  updated_at: string;
}

interface DailyLogRow {
  date: string;
  quests_completed: number;
  xp_earned: number;
  updated_at: string;
}

// Supabase에서 반환되는 원격 레코드 타입
interface RemoteSettings {
  user_id: string;
  resignation_date: string;
  runway_months: number;
  start_date: string | null;
  player_name: string;
  level: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  updated_at: string;
}

interface RemoteQuest {
  id: string;
  user_id: string;
  local_id: number;
  category: string;
  title: string;
  description: string;
  completed: boolean;
  progress: number;
  sort_order: number;
  difficulty: string;
  xp: number;
  deadline: string | null;
  completed_at: string | null;
  updated_at: string;
}

interface RemoteMilestone {
  id: string;
  user_id: string;
  local_id: number;
  quest_id: string; // Supabase의 quests.id (UUID)
  title: string;
  completed: boolean;
  sort_order: number;
  updated_at: string;
}

interface RemoteDailyLog {
  user_id: string;
  date: string;
  quests_completed: number;
  xp_earned: number;
  updated_at: string;
}

// ─── 상태 관리 ─────────────────────────────────────────────────────────────

let syncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

const SYNC_INTERVAL_MS = 30_000; // 30초

// ─── 네트워크 연결 확인 ────────────────────────────────────────────────────

/**
 * Node.js 환경에서 인터넷 연결 여부 확인.
 * DNS 조회(8.8.8.8 포트 53 TCP)로 빠르게 판단.
 */
function checkOnline(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '8.8.8.8', port: 53 });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

// ─── 동기화 전제 조건 확인 ────────────────────────────────────────────────

/**
 * 동기화 가능 여부 확인.
 * Supabase 설정 + 로그인 세션 모두 필요.
 */
async function canSync(): Promise<{ ok: boolean; userId?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false };
  }

  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return { ok: false };
    }
    return { ok: true, userId: session.user.id };
  } catch {
    return { ok: false };
  }
}

// ─── Push: 로컬 → Supabase ────────────────────────────────────────────────

/**
 * dirty 표시된 레코드를 Supabase로 밀어넣기.
 * 삭제된 항목은 원격에서도 제거 후 sync_meta 항목 삭제.
 */
export async function pushChanges(): Promise<void> {
  const { ok, userId } = await canSync();
  if (!ok || !userId) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const db = getDb();
  const dirtyRecords = db
    .prepare('SELECT * FROM sync_meta WHERE is_dirty = 1')
    .all() as SyncMeta[];

  if (dirtyRecords.length === 0) return;

  const now = new Date().toISOString();

  for (const meta of dirtyRecords) {
    try {
      // ── 삭제 처리 ──
      if (meta.is_deleted === 1) {
        if (meta.remote_id) {
          await handleRemoteDelete(supabase, meta, userId);
        }
        // sync_meta 항목 제거
        db.prepare(
          'DELETE FROM sync_meta WHERE table_name = ? AND local_id = ?',
        ).run(meta.table_name, meta.local_id);
        continue;
      }

      // ── 테이블별 upsert ──
      switch (meta.table_name) {
        case 'settings':
          await pushSettings(supabase, db, userId, meta, now);
          break;
        case 'quests':
          await pushQuest(supabase, db, userId, meta, now);
          break;
        case 'milestones':
          await pushMilestone(supabase, db, userId, meta, now);
          break;
        case 'daily_logs':
          await pushDailyLog(supabase, db, userId, meta, now);
          break;
        default:
          console.warn(`[sync] 알 수 없는 테이블: ${meta.table_name}`);
      }
    } catch (err) {
      console.error(
        `[sync] push 실패 (table=${meta.table_name}, local_id=${meta.local_id}):`,
        err,
      );
      // 개별 실패는 건너뜀 - 다음 싸이클에 재시도
    }
  }
}

/** sync_meta를 성공 상태로 업데이트 */
function markSyncSuccess(
  db: ReturnType<typeof getDb>,
  tableName: string,
  localId: number,
  remoteId: string,
  syncedAt: string,
): void {
  db.prepare(
    `INSERT INTO sync_meta (table_name, local_id, remote_id, last_synced_at, is_dirty, is_deleted)
     VALUES (?, ?, ?, ?, 0, 0)
     ON CONFLICT(table_name, local_id) DO UPDATE SET
       remote_id = excluded.remote_id,
       last_synced_at = excluded.last_synced_at,
       is_dirty = 0`,
  ).run(tableName, localId, remoteId, syncedAt);
}

/** 원격 레코드 삭제 처리 */
async function handleRemoteDelete(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  meta: SyncMeta,
  userId: string,
): Promise<void> {
  switch (meta.table_name) {
    case 'quests':
      if (meta.remote_id) {
        await supabase
          .from('quests')
          .delete()
          .eq('id', meta.remote_id)
          .eq('user_id', userId);
      }
      break;
    case 'milestones':
      if (meta.remote_id) {
        await supabase
          .from('milestones')
          .delete()
          .eq('id', meta.remote_id)
          .eq('user_id', userId);
      }
      break;
    case 'daily_logs': {
      // daily_logs의 local_id는 날짜를 YYYYMMDD 정수로 변환한 값
      const dateStr = localIdToDateString(meta.local_id);
      await supabase
        .from('daily_logs')
        .delete()
        .eq('user_id', userId)
        .eq('date', dateStr);
      break;
    }
    default:
      break;
  }
}

/** settings 테이블 push */
async function pushSettings(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  db: ReturnType<typeof getDb>,
  userId: string,
  _meta: SyncMeta,
  now: string,
): Promise<void> {
  const row = db
    .prepare('SELECT * FROM settings WHERE id = 1')
    .get() as SettingsRow | undefined;

  if (!row) return;

  const payload: RemoteSettings = {
    user_id: userId,
    resignation_date: row.resignation_date,
    runway_months: row.runway_months,
    start_date: row.start_date,
    player_name: row.player_name,
    level: row.level,
    total_xp: row.total_xp,
    current_streak: row.current_streak,
    longest_streak: row.longest_streak,
    last_active_date: row.last_active_date,
    updated_at: row.updated_at,
  };

  const { error } = await supabase
    .from('settings')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) throw error;

  // settings의 remote_id는 user_id
  markSyncSuccess(db, 'settings', 1, userId, now);
}

/** quests 테이블 push */
async function pushQuest(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  db: ReturnType<typeof getDb>,
  userId: string,
  meta: SyncMeta,
  now: string,
): Promise<void> {
  const row = db
    .prepare('SELECT * FROM quests WHERE id = ?')
    .get(meta.local_id) as QuestRow | undefined;

  if (!row) return;

  // remote_id가 있으면 기존 레코드 업데이트, 없으면 새로 삽입
  const payload: Omit<RemoteQuest, 'id'> & { id?: string } = {
    user_id: userId,
    local_id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    completed: Boolean(row.completed),
    progress: row.progress,
    sort_order: row.sort_order,
    difficulty: row.difficulty,
    xp: row.xp,
    deadline: row.deadline,
    completed_at: row.completed_at,
    updated_at: row.updated_at,
  };

  if (meta.remote_id) {
    payload.id = meta.remote_id;
  }

  const { data, error } = await supabase
    .from('quests')
    .upsert(payload, { onConflict: meta.remote_id ? 'id' : 'user_id,local_id' })
    .select('id')
    .single();

  if (error) throw error;

  const remoteId = (data as { id: string })?.id ?? meta.remote_id ?? '';
  if (remoteId) {
    markSyncSuccess(db, 'quests', meta.local_id, remoteId, now);
  }
}

/** milestones 테이블 push */
async function pushMilestone(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  db: ReturnType<typeof getDb>,
  userId: string,
  meta: SyncMeta,
  now: string,
): Promise<void> {
  const row = db
    .prepare('SELECT * FROM milestones WHERE id = ?')
    .get(meta.local_id) as MilestoneRow | undefined;

  if (!row) return;

  // 부모 퀘스트의 remote_id 조회
  const questMeta = db
    .prepare('SELECT remote_id FROM sync_meta WHERE table_name = ? AND local_id = ?')
    .get('quests', row.quest_id) as { remote_id: string | null } | undefined;

  if (!questMeta?.remote_id) {
    // 부모 퀘스트가 아직 원격에 동기화되지 않음 - 나중에 재시도
    console.warn(
      `[sync] milestone ${meta.local_id}: 부모 퀘스트(${row.quest_id})가 아직 동기화되지 않음`,
    );
    return;
  }

  const payload: Omit<RemoteMilestone, 'id'> & { id?: string } = {
    user_id: userId,
    local_id: row.id,
    quest_id: questMeta.remote_id,
    title: row.title,
    completed: Boolean(row.completed),
    sort_order: row.sort_order,
    updated_at: row.updated_at,
  };

  if (meta.remote_id) {
    payload.id = meta.remote_id;
  }

  const { data, error } = await supabase
    .from('milestones')
    .upsert(payload, { onConflict: meta.remote_id ? 'id' : 'user_id,local_id' })
    .select('id')
    .single();

  if (error) throw error;

  const remoteId = (data as { id: string })?.id ?? meta.remote_id ?? '';
  if (remoteId) {
    markSyncSuccess(db, 'milestones', meta.local_id, remoteId, now);
  }
}

/** daily_logs 테이블 push */
async function pushDailyLog(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  db: ReturnType<typeof getDb>,
  userId: string,
  meta: SyncMeta,
  now: string,
): Promise<void> {
  // local_id는 YYYYMMDD 정수 형태의 날짜
  const dateStr = localIdToDateString(meta.local_id);

  const row = db
    .prepare('SELECT * FROM daily_logs WHERE date = ?')
    .get(dateStr) as DailyLogRow | undefined;

  if (!row) return;

  const payload: RemoteDailyLog = {
    user_id: userId,
    date: row.date,
    quests_completed: row.quests_completed,
    xp_earned: row.xp_earned,
    updated_at: row.updated_at,
  };

  const { error } = await supabase
    .from('daily_logs')
    .upsert(payload, { onConflict: 'user_id,date' });

  if (error) throw error;

  // daily_logs의 remote_id는 복합키이므로 user_id+date 조합 문자열 사용
  const remoteId = `${userId}:${dateStr}`;
  markSyncSuccess(db, 'daily_logs', meta.local_id, remoteId, now);
}

// ─── Pull: Supabase → 로컬 ────────────────────────────────────────────────

/**
 * Supabase에서 변경된 레코드를 로컬 SQLite로 가져오기.
 * last_synced_at 이후에 updated_at이 갱신된 레코드만 조회.
 */
export async function pullChanges(): Promise<void> {
  const { ok, userId } = await canSync();
  if (!ok || !userId) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const db = getDb();

  // 전체 sync_meta에서 가장 최근 last_synced_at 조회
  const latestMeta = db
    .prepare('SELECT MAX(last_synced_at) as latest FROM sync_meta')
    .get() as { latest: string | null };

  // 동기화 기준 시간: 없으면 epoch(전체 조회)
  const since = latestMeta.latest ?? '1970-01-01T00:00:00.000Z';

  await Promise.all([
    pullSettings(supabase, db, userId, since),
    pullQuests(supabase, db, userId, since),
    pullMilestones(supabase, db, userId, since),
    pullDailyLogs(supabase, db, userId, since),
  ]);
}

/** settings pull */
async function pullSettings(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  db: ReturnType<typeof getDb>,
  userId: string,
  since: string,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', since)
      .single();

    if (error || !data) return;

    const remote = data as RemoteSettings;

    // Last-Write-Wins: 로컬 updated_at과 비교
    const localRow = db
      .prepare('SELECT updated_at FROM settings WHERE id = 1')
      .get() as { updated_at: string } | undefined;

    if (localRow && localRow.updated_at >= remote.updated_at) {
      // 로컬이 더 최신 - 건너뜀
      return;
    }

    // 로컬 upsert
    db.prepare(
      `INSERT INTO settings (id, resignation_date, runway_months, start_date, player_name, level, total_xp, current_streak, longest_streak, last_active_date, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         resignation_date = excluded.resignation_date,
         runway_months = excluded.runway_months,
         start_date = excluded.start_date,
         player_name = excluded.player_name,
         level = excluded.level,
         total_xp = excluded.total_xp,
         current_streak = excluded.current_streak,
         longest_streak = excluded.longest_streak,
         last_active_date = excluded.last_active_date,
         updated_at = excluded.updated_at`,
    ).run(
      remote.resignation_date,
      remote.runway_months,
      remote.start_date,
      remote.player_name,
      remote.level,
      remote.total_xp,
      remote.current_streak,
      remote.longest_streak,
      remote.last_active_date,
      remote.updated_at,
    );

    // sync_meta: is_dirty=0으로 갱신 (방금 받은 데이터이므로 clean)
    const now = new Date().toISOString();
    markSyncSuccess(db, 'settings', 1, userId, now);
  } catch (err) {
    console.error('[sync] settings pull 실패:', err);
  }
}

/** quests pull */
async function pullQuests(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  db: ReturnType<typeof getDb>,
  userId: string,
  since: string,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('quests')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', since);

    if (error || !data) return;

    const now = new Date().toISOString();

    for (const remote of data as RemoteQuest[]) {
      try {
        // 로컬에 local_id로 매핑된 레코드가 있는지 확인
        const localId = remote.local_id;

        if (localId) {
          // Last-Write-Wins 비교
          const localRow = db
            .prepare('SELECT updated_at FROM quests WHERE id = ?')
            .get(localId) as { updated_at: string } | undefined;

          if (localRow && localRow.updated_at >= remote.updated_at) {
            continue; // 로컬이 더 최신
          }

          // 로컬 업데이트
          db.prepare(
            `UPDATE quests SET
               category = ?,
               title = ?,
               description = ?,
               completed = ?,
               progress = ?,
               sort_order = ?,
               difficulty = ?,
               xp = ?,
               deadline = ?,
               completed_at = ?,
               updated_at = ?
             WHERE id = ?`,
          ).run(
            remote.category,
            remote.title,
            remote.description,
            remote.completed ? 1 : 0,
            remote.progress,
            remote.sort_order,
            remote.difficulty,
            remote.xp,
            remote.deadline,
            remote.completed_at,
            remote.updated_at,
            localId,
          );

          markSyncSuccess(db, 'quests', localId, remote.id, now);
        } else {
          // local_id가 없으면 새 로컬 레코드 삽입
          const result = db.prepare(
            `INSERT INTO quests (category, title, description, completed, progress, sort_order, difficulty, xp, deadline, completed_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(
            remote.category,
            remote.title,
            remote.description,
            remote.completed ? 1 : 0,
            remote.progress,
            remote.sort_order,
            remote.difficulty,
            remote.xp,
            remote.deadline,
            remote.completed_at,
            remote.updated_at,
          );

          const newLocalId = Number(result.lastInsertRowid);
          markSyncSuccess(db, 'quests', newLocalId, remote.id, now);
        }
      } catch (itemErr) {
        console.error(`[sync] quest pull 아이템 처리 실패 (remote.id=${remote.id}):`, itemErr);
      }
    }
  } catch (err) {
    console.error('[sync] quests pull 실패:', err);
  }
}

/** milestones pull */
async function pullMilestones(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  db: ReturnType<typeof getDb>,
  userId: string,
  since: string,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', since);

    if (error || !data) return;

    const now = new Date().toISOString();

    for (const remote of data as RemoteMilestone[]) {
      try {
        // 원격 quest_id → 로컬 quest_id 매핑
        const questSyncMeta = db
          .prepare('SELECT local_id FROM sync_meta WHERE table_name = ? AND remote_id = ?')
          .get('quests', remote.quest_id) as { local_id: number } | undefined;

        if (!questSyncMeta) {
          console.warn(`[sync] milestone pull: 부모 퀘스트 매핑 없음 (remote quest_id=${remote.quest_id})`);
          continue;
        }

        const localQuestId = questSyncMeta.local_id;
        const localId = remote.local_id;

        if (localId) {
          // Last-Write-Wins 비교
          const localRow = db
            .prepare('SELECT updated_at FROM milestones WHERE id = ?')
            .get(localId) as { updated_at: string } | undefined;

          if (localRow && localRow.updated_at >= remote.updated_at) {
            continue;
          }

          db.prepare(
            `UPDATE milestones SET
               quest_id = ?,
               title = ?,
               completed = ?,
               sort_order = ?,
               updated_at = ?
             WHERE id = ?`,
          ).run(
            localQuestId,
            remote.title,
            remote.completed ? 1 : 0,
            remote.sort_order,
            remote.updated_at,
            localId,
          );

          markSyncSuccess(db, 'milestones', localId, remote.id, now);
        } else {
          // 새 로컬 레코드 삽입
          const result = db.prepare(
            `INSERT INTO milestones (quest_id, title, completed, sort_order, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
          ).run(
            localQuestId,
            remote.title,
            remote.completed ? 1 : 0,
            remote.sort_order,
            remote.updated_at,
          );

          const newLocalId = Number(result.lastInsertRowid);
          markSyncSuccess(db, 'milestones', newLocalId, remote.id, now);
        }
      } catch (itemErr) {
        console.error(`[sync] milestone pull 아이템 처리 실패 (remote.id=${remote.id}):`, itemErr);
      }
    }
  } catch (err) {
    console.error('[sync] milestones pull 실패:', err);
  }
}

/** daily_logs pull */
async function pullDailyLogs(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  db: ReturnType<typeof getDb>,
  userId: string,
  since: string,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', since);

    if (error || !data) return;

    const now = new Date().toISOString();

    for (const remote of data as RemoteDailyLog[]) {
      try {
        // Last-Write-Wins 비교
        const localRow = db
          .prepare('SELECT updated_at FROM daily_logs WHERE date = ?')
          .get(remote.date) as { updated_at: string } | undefined;

        if (localRow && localRow.updated_at >= remote.updated_at) {
          continue;
        }

        db.prepare(
          `INSERT INTO daily_logs (date, quests_completed, xp_earned, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(date) DO UPDATE SET
             quests_completed = excluded.quests_completed,
             xp_earned = excluded.xp_earned,
             updated_at = excluded.updated_at`,
        ).run(
          remote.date,
          remote.quests_completed,
          remote.xp_earned,
          remote.updated_at,
        );

        const localId = dateStringToLocalId(remote.date);
        const remoteId = `${userId}:${remote.date}`;
        markSyncSuccess(db, 'daily_logs', localId, remoteId, now);
      } catch (itemErr) {
        console.error(`[sync] daily_log pull 아이템 처리 실패 (date=${remote.date}):`, itemErr);
      }
    }
  } catch (err) {
    console.error('[sync] daily_logs pull 실패:', err);
  }
}

// ─── Full Sync ────────────────────────────────────────────────────────────

/**
 * Push 후 Pull 순서로 전체 동기화 실행.
 * 오류가 발생해도 앱을 중단시키지 않음.
 */
export async function fullSync(): Promise<void> {
  if (isSyncing) {
    console.log('[sync] 이미 동기화 진행 중 - 건너뜀');
    return;
  }

  const online = await checkOnline();
  if (!online) {
    console.log('[sync] 오프라인 상태 - 동기화 건너뜀');
    return;
  }

  isSyncing = true;
  console.log('[sync] 동기화 시작');

  try {
    await pushChanges();
    await pullChanges();
    console.log('[sync] 동기화 완료');
  } catch (err) {
    // 동기화 실패는 앱을 중단시키지 않음
    console.error('[sync] fullSync 오류 (앱 계속 실행):', err);
  } finally {
    isSyncing = false;
  }
}

// ─── 주기적 동기화 제어 ────────────────────────────────────────────────────

/**
 * 30초 간격으로 주기적 동기화 시작.
 * Supabase가 설정되고 사용자가 로그인된 경우에만 실제 동기화 수행.
 *
 * @returns 정리 함수 (타이머 해제)
 */
export function startSync(): () => void {
  if (syncTimer) {
    console.log('[sync] 이미 실행 중인 동기화 타이머가 있음');
    return () => stopSync();
  }

  console.log(`[sync] 주기적 동기화 시작 (간격: ${SYNC_INTERVAL_MS / 1000}초)`);

  // 최초 즉시 실행
  fullSync().catch((err) => {
    console.error('[sync] 초기 동기화 오류:', err);
  });

  syncTimer = setInterval(() => {
    fullSync().catch((err) => {
      console.error('[sync] 주기적 동기화 오류:', err);
    });
  }, SYNC_INTERVAL_MS);

  return () => stopSync();
}

/**
 * 주기적 동기화 타이머 중지.
 */
export function stopSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('[sync] 주기적 동기화 중지');
  }
}

// ─── 상태 조회 ────────────────────────────────────────────────────────────

/**
 * 현재 동기화 상태 반환.
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const db = getDb();

  // 마지막 동기화 시각 (sync_meta 전체에서 가장 최근)
  const latestMeta = db
    .prepare('SELECT MAX(last_synced_at) as latest FROM sync_meta')
    .get() as { latest: string | null };

  // 대기 중인 변경 수 (dirty 레코드)
  const pendingMeta = db
    .prepare('SELECT COUNT(*) as cnt FROM sync_meta WHERE is_dirty = 1')
    .get() as { cnt: number };

  const online = await checkOnline().catch(() => false);

  return {
    lastSyncedAt: latestMeta.latest,
    pendingChanges: pendingMeta.cnt,
    isOnline: online,
    isSyncing,
  };
}

// ─── 유틸리티 ────────────────────────────────────────────────────────────

/**
 * YYYYMMDD 정수 → "YYYY-MM-DD" 문자열 변환.
 * daily_logs의 local_id 인코딩 역함수.
 */
function localIdToDateString(localId: number): string {
  const s = String(localId);
  // 20230115 → "2023-01-15"
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * "YYYY-MM-DD" 문자열 → YYYYMMDD 정수 변환.
 * database.ts의 `parseInt(today.replace(/-/g, ''), 10)` 패턴과 동일.
 */
function dateStringToLocalId(dateStr: string): number {
  return parseInt(dateStr.replace(/-/g, ''), 10);
}
