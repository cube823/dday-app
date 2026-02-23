import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

// ─── Types (local, electron-only) ────────────────────────────────────────────

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

interface CamelSettings {
  resignationDate: string;
  runwayMonths: number;
  startDate: string | null;
  playerName: string;
  level: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
}

interface CamelQuest {
  id: number;
  category: string;
  title: string;
  description: string;
  completed: boolean;
  progress: number;
  sortOrder: number;
  difficulty: string;
  xp: number;
  deadline: string | null;
  completedAt: string | null;
}

interface CamelMilestone {
  id: number;
  questId: number;
  title: string;
  completed: boolean;
  sortOrder: number;
}

interface CamelDailyLog {
  date: string;
  questsCompleted: number;
  xpEarned: number;
}

interface CompleteQuestResult {
  xpEarned: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  currentStreak: number;
  longestStreak: number;
}

// JSON file 구조 (마이그레이션용)
interface JsonDatabase {
  settings: {
    resignation_date: string;
    runway_months: number;
    start_date: string | null;
    player_name: string;
    level: number;
    total_xp: number;
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
  };
  learning_steps: Array<{
    id: number;
    category: string;
    title: string;
    description: string;
    completed: number;
    progress: number;
    order: number;
    difficulty: string;
    xp: number;
    deadline: string | null;
    completed_at: string | null;
  }>;
  milestones: Array<{
    id: number;
    step_id: number;
    title: string;
    completed: number;
    order: number;
  }>;
  daily_logs: Array<{
    date: string;
    quests_completed: number;
    xp_earned: number;
  }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DIFFICULTY_XP: Record<string, number> = {
  easy: 50,
  normal: 100,
  hard: 200,
  epic: 500,
};

// ─── Singleton ───────────────────────────────────────────────────────────────

let db: Database.Database | null = null;

// ─── snake_case <-> camelCase 변환 헬퍼 ──────────────────────────────────────

function settingsToCamel(row: SettingsRow): CamelSettings {
  return {
    resignationDate: row.resignation_date,
    runwayMonths: row.runway_months,
    startDate: row.start_date,
    playerName: row.player_name,
    level: row.level,
    totalXp: row.total_xp,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    lastActiveDate: row.last_active_date,
  };
}

function questToCamel(row: QuestRow): CamelQuest {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    completed: Boolean(row.completed),
    progress: row.progress,
    sortOrder: row.sort_order,
    difficulty: row.difficulty || 'normal',
    xp: row.xp || 100,
    deadline: row.deadline || null,
    completedAt: row.completed_at || null,
  };
}

function milestoneToCamel(row: MilestoneRow): CamelMilestone {
  return {
    id: row.id,
    questId: row.quest_id,
    title: row.title,
    completed: Boolean(row.completed),
    sortOrder: row.sort_order,
  };
}

function dailyLogToCamel(row: DailyLogRow): CamelDailyLog {
  return {
    date: row.date,
    questsCompleted: row.quests_completed,
    xpEarned: row.xp_earned,
  };
}

/** camelCase 설정 객체를 snake_case 컬럼 매핑으로 변환 */
function settingsToSnake(
  settings: Partial<CamelSettings>,
): Record<string, unknown> {
  const map: Record<string, string> = {
    resignationDate: 'resignation_date',
    runwayMonths: 'runway_months',
    startDate: 'start_date',
    playerName: 'player_name',
    level: 'level',
    totalXp: 'total_xp',
    currentStreak: 'current_streak',
    longestStreak: 'longest_streak',
    lastActiveDate: 'last_active_date',
  };

  const result: Record<string, unknown> = {};
  for (const [camel, value] of Object.entries(settings)) {
    const snake = map[camel];
    if (snake !== undefined) {
      result[snake] = value;
    }
  }
  return result;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    resignation_date TEXT NOT NULL,
    runway_months INTEGER NOT NULL DEFAULT 12,
    start_date TEXT,
    player_name TEXT NOT NULL DEFAULT '모험가',
    level INTEGER NOT NULL DEFAULT 1,
    total_xp INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_active_date TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    completed INTEGER NOT NULL DEFAULT 0,
    progress INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    difficulty TEXT NOT NULL DEFAULT 'normal',
    xp INTEGER NOT NULL DEFAULT 100,
    deadline TEXT,
    completed_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quest_id INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    date TEXT PRIMARY KEY,
    quests_completed INTEGER NOT NULL DEFAULT 0,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sync_meta (
    table_name TEXT NOT NULL,
    local_id INTEGER NOT NULL,
    remote_id TEXT,
    last_synced_at TEXT,
    is_dirty INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (table_name, local_id)
  );
`;

// ─── Database Lifecycle ──────────────────────────────────────────────────────

/** DB 초기화: 파일 생성, 테이블 생성, WAL 모드 활성화, JSON 마이그레이션 */
export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'dday.db');

  db = new Database(dbPath);

  // WAL 모드 (동시 읽기 성능 향상)
  db.pragma('journal_mode = WAL');
  // 외래키 제약 활성화
  db.pragma('foreign_keys = ON');

  // 테이블 생성
  db.exec(SCHEMA);

  // JSON 파일에서 마이그레이션
  migrateFromJson();
}

/** better-sqlite3 Database 인스턴스 싱글톤 getter */
export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/** DB 연결 종료 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ─── JSON Migration ──────────────────────────────────────────────────────────

/**
 * 기존 dday-data.json 파일에서 SQLite로 데이터 마이그레이션.
 * SQLite에 데이터가 없는 경우에만 실행.
 */
export function migrateFromJson(): void {
  const database = getDb();

  // settings 테이블에 데이터가 있으면 이미 마이그레이션 완료
  const existing = database.prepare('SELECT COUNT(*) as cnt FROM settings').get() as { cnt: number };
  if (existing.cnt > 0) return;

  // JSON 파일 탐색: userData 우선, fallback으로 process.cwd()/data/
  let jsonData: JsonDatabase | null = null;

  const primaryPath = path.join(app.getPath('userData'), 'dday-data.json');
  const fallbackPath = path.join(process.cwd(), 'data', 'dday-data.json');

  for (const jsonPath of [primaryPath, fallbackPath]) {
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        jsonData = JSON.parse(raw) as JsonDatabase;
        break;
      } catch {
        // 파싱 실패 시 다음 경로 시도
      }
    }
  }

  if (!jsonData) return;

  // 트랜잭션으로 일괄 삽입
  const migrate = database.transaction(() => {
    // Settings
    const s = jsonData!.settings;
    database
      .prepare(
        `INSERT INTO settings (id, resignation_date, runway_months, start_date, player_name, level, total_xp, current_streak, longest_streak, last_active_date)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        s.resignation_date,
        s.runway_months ?? 12,
        s.start_date ?? null,
        s.player_name ?? '모험가',
        s.level ?? 1,
        s.total_xp ?? 0,
        s.current_streak ?? 0,
        s.longest_streak ?? 0,
        s.last_active_date ?? null,
      );

    // Quests (learning_steps -> quests)
    const insertQuest = database.prepare(
      `INSERT INTO quests (id, category, title, description, completed, progress, sort_order, difficulty, xp, deadline, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const step of jsonData!.learning_steps || []) {
      const difficulty = step.difficulty || 'normal';
      insertQuest.run(
        step.id,
        step.category,
        step.title,
        step.description || '',
        step.completed ? 1 : 0,
        step.progress ?? 0,
        step.order ?? 0,
        difficulty,
        step.xp || DIFFICULTY_XP[difficulty] || 100,
        step.deadline ?? null,
        step.completed_at ?? null,
      );
    }

    // Milestones
    const insertMilestone = database.prepare(
      `INSERT INTO milestones (id, quest_id, title, completed, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
    );

    for (const m of jsonData!.milestones || []) {
      insertMilestone.run(
        m.id,
        m.step_id,
        m.title,
        m.completed ? 1 : 0,
        m.order ?? 0,
      );
    }

    // Daily Logs
    const insertLog = database.prepare(
      `INSERT INTO daily_logs (date, quests_completed, xp_earned)
       VALUES (?, ?, ?)`,
    );

    for (const log of jsonData!.daily_logs || []) {
      insertLog.run(
        log.date,
        log.quests_completed ?? 0,
        log.xp_earned ?? 0,
      );
    }
  });

  migrate();
}

// ─── Sync Meta ───────────────────────────────────────────────────────────────

/** sync_meta 테이블에 dirty 마킹 (향후 원격 동기화용) */
export function markDirty(tableName: string, localId: number): void {
  const database = getDb();
  database
    .prepare(
      `INSERT INTO sync_meta (table_name, local_id, is_dirty)
       VALUES (?, ?, 1)
       ON CONFLICT(table_name, local_id) DO UPDATE SET is_dirty = 1`,
    )
    .run(tableName, localId);
}

// ─── Settings ────────────────────────────────────────────────────────────────

/** 설정 조회. 행이 없으면 기본값 삽입 후 반환 */
export function getSettings(): CamelSettings {
  const database = getDb();

  let row = database.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow | undefined;

  if (!row) {
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() + 1);
    const resignationDate = defaultDate.toISOString().split('T')[0];

    database
      .prepare(
        `INSERT INTO settings (id, resignation_date, runway_months, player_name, level, total_xp, current_streak, longest_streak)
         VALUES (1, ?, 12, '모험가', 1, 0, 0, 0)`,
      )
      .run(resignationDate);

    row = database.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow;
  }

  return settingsToCamel(row);
}

/** 설정 부분 업데이트 (camelCase 입력 -> snake_case 변환) */
export function updateSettings(settings: Partial<CamelSettings>): void {
  const database = getDb();
  const snakeData = settingsToSnake(settings);
  const keys = Object.keys(snakeData);

  if (keys.length === 0) return;

  const setClauses = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => snakeData[k]);

  database
    .prepare(`UPDATE settings SET ${setClauses}, updated_at = datetime('now') WHERE id = 1`)
    .run(...values);

  markDirty('settings', 1);
}

// ─── Quests ──────────────────────────────────────────────────────────────────

/** 모든 퀘스트를 sort_order 순으로 조회 */
export function getQuests(): CamelQuest[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM quests ORDER BY sort_order ASC')
    .all() as QuestRow[];
  return rows.map(questToCamel);
}

/** 퀘스트 추가 (camelCase partial). 새 id 반환 */
export function addQuest(quest: Partial<CamelQuest>): number {
  const database = getDb();
  const difficulty = quest.difficulty || 'normal';
  const xp = quest.xp ?? DIFFICULTY_XP[difficulty] ?? 100;

  const result = database
    .prepare(
      `INSERT INTO quests (category, title, description, completed, progress, sort_order, difficulty, xp, deadline, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      quest.category ?? '',
      quest.title ?? '',
      quest.description ?? '',
      quest.completed ? 1 : 0,
      quest.progress ?? 0,
      quest.sortOrder ?? 0,
      difficulty,
      xp,
      quest.deadline ?? null,
      quest.completedAt ?? null,
    );

  const newId = Number(result.lastInsertRowid);
  markDirty('quests', newId);
  return newId;
}

/** 퀘스트 업데이트 (camelCase) */
export function updateQuest(quest: Partial<CamelQuest> & { id: number }): void {
  const database = getDb();
  const difficulty = quest.difficulty || 'normal';
  const xp = quest.xp ?? DIFFICULTY_XP[difficulty] ?? 100;

  database
    .prepare(
      `UPDATE quests SET
         category = COALESCE(?, category),
         title = COALESCE(?, title),
         description = COALESCE(?, description),
         completed = COALESCE(?, completed),
         progress = COALESCE(?, progress),
         sort_order = COALESCE(?, sort_order),
         difficulty = ?,
         xp = ?,
         deadline = CASE WHEN ?1 = 1 THEN ? ELSE deadline END,
         completed_at = CASE WHEN ?2 = 1 THEN ? ELSE completed_at END,
         updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      quest.category ?? null,
      quest.title ?? null,
      quest.description ?? null,
      quest.completed !== undefined ? (quest.completed ? 1 : 0) : null,
      quest.progress ?? null,
      quest.sortOrder ?? null,
      difficulty,
      xp,
      quest.deadline !== undefined ? 1 : 0,
      quest.deadline ?? null,
      quest.completedAt !== undefined ? 1 : 0,
      quest.completedAt ?? null,
      quest.id,
    );

  markDirty('quests', quest.id);
}

/** 퀘스트 삭제 (CASCADE로 milestones도 삭제) */
export function deleteQuest(id: number): void {
  const database = getDb();
  database.prepare('DELETE FROM quests WHERE id = ?').run(id);
  // sync_meta에서도 삭제
  database
    .prepare('DELETE FROM sync_meta WHERE table_name = ? AND local_id = ?')
    .run('quests', id);
  // milestones의 sync_meta도 정리
  database
    .prepare(
      `DELETE FROM sync_meta WHERE table_name = 'milestones' AND local_id IN (
         SELECT id FROM milestones WHERE quest_id = ?
       )`,
    )
    .run(id);
}

/**
 * 퀘스트 완료 처리 (트랜잭션).
 *
 * 1. 퀘스트 completed=1, progress=100, completed_at=today
 * 2. XP 부여
 * 3. 레벨 재계산 (각 레벨 = level * 150 XP 누적)
 * 4. 스트릭 업데이트
 * 5. daily_log upsert
 * 6. sync_meta dirty 마킹
 */
export function completeQuest(id: number): CompleteQuestResult | null {
  const database = getDb();

  const doComplete = database.transaction((): CompleteQuestResult | null => {
    // 퀘스트 조회
    const quest = database
      .prepare('SELECT * FROM quests WHERE id = ?')
      .get(id) as QuestRow | undefined;

    if (!quest || quest.completed) return null;

    const today = new Date().toISOString().split('T')[0];

    // 1. 퀘스트 완료 처리
    database
      .prepare(
        `UPDATE quests SET completed = 1, progress = 100, completed_at = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(today, id);

    // 2. XP 부여
    const xpEarned = quest.xp || DIFFICULTY_XP[quest.difficulty] || 100;

    const settingsRow = database
      .prepare('SELECT * FROM settings WHERE id = 1')
      .get() as SettingsRow;

    const newTotalXp = settingsRow.total_xp + xpEarned;

    // 3. 레벨 재계산: 각 레벨마다 level * 150 XP 필요 (누적)
    const oldLevel = settingsRow.level;
    let totalXpNeeded = 0;
    let newLevel = 1;
    while (true) {
      totalXpNeeded += newLevel * 150;
      if (newTotalXp < totalXpNeeded) break;
      newLevel++;
    }
    const leveledUp = newLevel > oldLevel;

    // 4. 스트릭 업데이트
    let currentStreak = settingsRow.current_streak;
    const lastActive = settingsRow.last_active_date;

    if (!lastActive) {
      // 첫 활동
      currentStreak = 1;
    } else if (lastActive === today) {
      // 오늘 이미 활동함 - 스트릭 변경 없음
    } else {
      const lastDate = new Date(lastActive);
      const todayDate = new Date(today);
      const diffMs = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // 연속일 -> 스트릭 증가
        currentStreak += 1;
      } else {
        // 연속 끊김 -> 리셋
        currentStreak = 1;
      }
    }

    const longestStreak = Math.max(currentStreak, settingsRow.longest_streak);

    // settings 업데이트
    database
      .prepare(
        `UPDATE settings SET
           total_xp = ?,
           level = ?,
           current_streak = ?,
           longest_streak = ?,
           last_active_date = ?,
           updated_at = datetime('now')
         WHERE id = 1`,
      )
      .run(newTotalXp, newLevel, currentStreak, longestStreak, today);

    // 5. daily_log upsert
    database
      .prepare(
        `INSERT INTO daily_logs (date, quests_completed, xp_earned, updated_at)
         VALUES (?, 1, ?, datetime('now'))
         ON CONFLICT(date) DO UPDATE SET
           quests_completed = quests_completed + 1,
           xp_earned = xp_earned + ?,
           updated_at = datetime('now')`,
      )
      .run(today, xpEarned, xpEarned);

    // 6. sync_meta dirty 마킹
    markDirty('settings', 1);
    markDirty('quests', id);
    // daily_log는 date 기반이므로 해시값 사용 (간단히 날짜를 숫자로 변환)
    const dateAsId = parseInt(today.replace(/-/g, ''), 10);
    markDirty('daily_logs', dateAsId);

    return {
      xpEarned,
      totalXp: newTotalXp,
      level: newLevel,
      leveledUp,
      oldLevel,
      newLevel,
      currentStreak,
      longestStreak,
    };
  });

  return doComplete();
}

// ─── Daily Logs ──────────────────────────────────────────────────────────────

/** 최근 30일 일일 로그 조회 (내림차순) */
export function getDailyLogs(): CamelDailyLog[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM daily_logs ORDER BY date DESC LIMIT 30')
    .all() as DailyLogRow[];
  return rows.map(dailyLogToCamel);
}

// ─── Today's Quests ──────────────────────────────────────────────────────────

/** 오늘의 퀘스트: 미완료 중 마감일 우선, 진행률 높은 순으로 상위 3개 */
export function getTodayQuests(): CamelQuest[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT * FROM quests
       WHERE completed = 0
       ORDER BY
         CASE WHEN deadline IS NOT NULL THEN 0 ELSE 1 END ASC,
         deadline ASC,
         progress DESC
       LIMIT 3`,
    )
    .all() as QuestRow[];
  return rows.map(questToCamel);
}

// ─── Milestones ──────────────────────────────────────────────────────────────

/** 특정 퀘스트의 마일스톤 조회 (sort_order 순) */
export function getMilestones(questId: number): CamelMilestone[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM milestones WHERE quest_id = ? ORDER BY sort_order ASC')
    .all(questId) as MilestoneRow[];
  return rows.map(milestoneToCamel);
}

/** 마일스톤 추가. stepId 또는 questId를 quest_id로 변환. 새 id 반환 */
export function addMilestone(milestone: Partial<CamelMilestone> & { stepId?: number }): number {
  const database = getDb();
  const questId = milestone.questId ?? milestone.stepId ?? 0;

  const result = database
    .prepare(
      `INSERT INTO milestones (quest_id, title, completed, sort_order)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      questId,
      milestone.title ?? '',
      milestone.completed ? 1 : 0,
      milestone.sortOrder ?? 0,
    );

  const newId = Number(result.lastInsertRowid);
  markDirty('milestones', newId);
  return newId;
}

/** 마일스톤 업데이트 */
export function updateMilestone(milestone: Partial<CamelMilestone> & { id: number }): void {
  const database = getDb();

  database
    .prepare(
      `UPDATE milestones SET
         title = COALESCE(?, title),
         completed = COALESCE(?, completed),
         sort_order = COALESCE(?, sort_order),
         updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(
      milestone.title ?? null,
      milestone.completed !== undefined ? (milestone.completed ? 1 : 0) : null,
      milestone.sortOrder ?? null,
      milestone.id,
    );

  markDirty('milestones', milestone.id);
}

/** 마일스톤 삭제 */
export function deleteMilestone(id: number): void {
  const database = getDb();
  database.prepare('DELETE FROM milestones WHERE id = ?').run(id);
  database
    .prepare('DELETE FROM sync_meta WHERE table_name = ? AND local_id = ?')
    .run('milestones', id);
}

export { DIFFICULTY_XP };
