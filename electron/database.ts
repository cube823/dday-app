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
  dopamine_tolerance: number;
  stat_willpower: number;
  stat_focus: number;
  abstinence_streak: number;
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
  dopamineTolerance: number;
  statWillpower: number;
  statFocus: number;
  abstinenceStreak: number;
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

interface DopamineCategoryRow {
  id: number;
  name: string;
  icon: string;
  tolerance_rate: number;
  is_preset: number;
  is_active: number;
  sort_order: number;
  updated_at: string;
}

interface CamelDopamineCategory {
  id: number;
  name: string;
  icon: string;
  toleranceRate: number;
  isPreset: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface DopamineLogRow {
  id: number;
  category_id: number;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  tolerance_gain: number | null;
  date: string;
  updated_at: string;
}

interface CamelDopamineLog {
  id: number;
  categoryId: number;
  startedAt: string;
  endedAt: string | null;
  durationMin: number | null;
  toleranceGain: number | null;
  date: string;
}

interface AbstinenceTimerRow {
  id: number;
  category_id: number;
  date: string;
  started_at: string;
  broken_at: string | null;
  is_success: number;
  updated_at: string;
}

interface CamelAbstinenceTimer {
  id: number;
  categoryId: number;
  date: string;
  startedAt: string;
  brokenAt: string | null;
  isSuccess: boolean;
}

interface DopamineDailyRow {
  date: string;
  tolerance_start: number;
  tolerance_end: number;
  total_usage_min: number;
  abstinence_success: number;
  abstinence_total: number;
  updated_at: string;
}

interface CamelDopamineDaily {
  date: string;
  toleranceStart: number;
  toleranceEnd: number;
  totalUsageMin: number;
  abstinenceSuccess: number;
  abstinenceTotal: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DIFFICULTY_XP: Record<string, number> = {
  easy: 50,
  normal: 100,
  hard: 200,
  epic: 500,
};

const TOLERANCE_STATES = [
  { max: 20, name: '각성 상태', willpower: 3, focus: 3, xpMultiplier: 1.0 },
  { max: 40, name: '맑은 정신', willpower: 2, focus: 2, xpMultiplier: 1.0 },
  { max: 60, name: '보통', willpower: 0, focus: 0, xpMultiplier: 1.0 },
  { max: 80, name: '흐릿한 정신', willpower: -1, focus: -1, xpMultiplier: 1.0 },
  { max: 100, name: '도파민 과부하', willpower: -2, focus: -2, xpMultiplier: 0.8 },
];

const QUEST_TOLERANCE_REDUCTION: Record<string, number> = {
  easy: -2, normal: -3, hard: -4, epic: -5,
};

function getToleranceState(tolerance: number) {
  const clamped = Math.max(0, Math.min(100, tolerance));
  return TOLERANCE_STATES.find(s => clamped <= s.max) || TOLERANCE_STATES[TOLERANCE_STATES.length - 1];
}

function recalcStats(database: ReturnType<typeof getDb>, tolerance: number): void {
  const state = getToleranceState(tolerance);
  database
    .prepare(
      `UPDATE settings SET dopamine_tolerance = ?, stat_willpower = ?, stat_focus = ?, updated_at = datetime('now') WHERE id = 1`
    )
    .run(Math.max(0, Math.min(100, tolerance)), state.willpower, state.focus);
}

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
    dopamineTolerance: row.dopamine_tolerance,
    statWillpower: row.stat_willpower,
    statFocus: row.stat_focus,
    abstinenceStreak: row.abstinence_streak,
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

function dopamineCategoryToCamel(row: DopamineCategoryRow): CamelDopamineCategory {
  return {
    id: row.id, name: row.name, icon: row.icon,
    toleranceRate: row.tolerance_rate,
    isPreset: Boolean(row.is_preset),
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
  };
}

function dopamineLogToCamel(row: DopamineLogRow): CamelDopamineLog {
  return {
    id: row.id, categoryId: row.category_id,
    startedAt: row.started_at, endedAt: row.ended_at,
    durationMin: row.duration_min, toleranceGain: row.tolerance_gain,
    date: row.date,
  };
}

function abstinenceTimerToCamel(row: AbstinenceTimerRow): CamelAbstinenceTimer {
  return {
    id: row.id, categoryId: row.category_id,
    date: row.date, startedAt: row.started_at,
    brokenAt: row.broken_at, isSuccess: Boolean(row.is_success),
  };
}

function dopamineDailyToCamel(row: DopamineDailyRow): CamelDopamineDaily {
  return {
    date: row.date, toleranceStart: row.tolerance_start,
    toleranceEnd: row.tolerance_end, totalUsageMin: row.total_usage_min,
    abstinenceSuccess: row.abstinence_success, abstinenceTotal: row.abstinence_total,
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
    dopamineTolerance: 'dopamine_tolerance',
    statWillpower: 'stat_willpower',
    statFocus: 'stat_focus',
    abstinenceStreak: 'abstinence_streak',
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
    dopamine_tolerance REAL NOT NULL DEFAULT 50,
    stat_willpower INTEGER NOT NULL DEFAULT 0,
    stat_focus INTEGER NOT NULL DEFAULT 0,
    abstinence_streak INTEGER NOT NULL DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS dopamine_categories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    icon            TEXT NOT NULL,
    tolerance_rate  REAL NOT NULL DEFAULT 0.2,
    is_preset       INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dopamine_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id     INTEGER NOT NULL REFERENCES dopamine_categories(id),
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    duration_min    REAL,
    tolerance_gain  REAL,
    date            TEXT NOT NULL,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS abstinence_timers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id     INTEGER NOT NULL REFERENCES dopamine_categories(id),
    date            TEXT NOT NULL,
    started_at      TEXT NOT NULL,
    broken_at       TEXT,
    is_success      INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dopamine_daily (
    date                TEXT PRIMARY KEY,
    tolerance_start     REAL NOT NULL,
    tolerance_end       REAL NOT NULL,
    total_usage_min     REAL NOT NULL DEFAULT 0,
    abstinence_success  INTEGER NOT NULL DEFAULT 0,
    abstinence_total    INTEGER NOT NULL DEFAULT 0,
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
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

  // 기존 DB에 도파민 컬럼이 없는 경우 마이그레이션
  migrateDopamineColumns();

  // JSON 파일에서 마이그레이션
  migrateFromJson();

  // 도파민 카테고리 기본값 시드
  seedDopamineCategories();
}

/** 기존 settings 테이블에 도파민 컬럼이 없으면 추가 */
function migrateDopamineColumns(): void {
  const database = getDb();
  const columns = database.pragma('table_info(settings)') as Array<{ name: string }>;
  const colNames = columns.map(c => c.name);

  const migrations = [
    { col: 'dopamine_tolerance', sql: 'ALTER TABLE settings ADD COLUMN dopamine_tolerance REAL NOT NULL DEFAULT 50' },
    { col: 'stat_willpower', sql: 'ALTER TABLE settings ADD COLUMN stat_willpower INTEGER NOT NULL DEFAULT 0' },
    { col: 'stat_focus', sql: 'ALTER TABLE settings ADD COLUMN stat_focus INTEGER NOT NULL DEFAULT 0' },
    { col: 'abstinence_streak', sql: 'ALTER TABLE settings ADD COLUMN abstinence_streak INTEGER NOT NULL DEFAULT 0' },
  ];

  for (const m of migrations) {
    if (!colNames.includes(m.col)) {
      database.exec(m.sql);
    }
  }
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

// ─── Dopamine Categories Seed ─────────────────────────────────────────────────

function seedDopamineCategories(): void {
  const database = getDb();
  const count = database.prepare('SELECT COUNT(*) as cnt FROM dopamine_categories').get() as { cnt: number };
  if (count.cnt > 0) return;

  const presets = [
    { name: 'SNS', icon: '📱', tolerance_rate: 0.15, sort_order: 0 },
    { name: '영상', icon: '📺', tolerance_rate: 0.2, sort_order: 1 },
    { name: '게임', icon: '🎮', tolerance_rate: 0.25, sort_order: 2 },
    { name: '쇼츠/릴스', icon: '📳', tolerance_rate: 0.3, sort_order: 3 },
    { name: '쇼핑', icon: '🛒', tolerance_rate: 0.15, sort_order: 4 },
    { name: '음주/야식', icon: '🍺', tolerance_rate: 0.2, sort_order: 5 },
  ];

  const insert = database.prepare(
    `INSERT INTO dopamine_categories (name, icon, tolerance_rate, is_preset, is_active, sort_order) VALUES (?, ?, ?, 1, 1, ?)`
  );
  for (const p of presets) {
    insert.run(p.name, p.icon, p.tolerance_rate, p.sort_order);
  }
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

    // Dopamine: reduce tolerance on quest completion
    const toleranceReduction = QUEST_TOLERANCE_REDUCTION[quest.difficulty] ?? -3;
    const currentTolerance = (settingsRow as unknown as { dopamine_tolerance: number }).dopamine_tolerance ?? 50;
    recalcStats(database, Math.max(0, currentTolerance + toleranceReduction));

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

// ─── Dopamine Categories ────────────────────────────────────────────────

export function getDopamineCategories(): CamelDopamineCategory[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM dopamine_categories WHERE is_active = 1 ORDER BY sort_order ASC')
    .all() as DopamineCategoryRow[];
  return rows.map(dopamineCategoryToCamel);
}

export function addDopamineCategory(cat: { name: string; icon: string; toleranceRate: number }): number {
  const database = getDb();
  const maxOrder = database
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM dopamine_categories')
    .get() as { next_order: number };
  const result = database
    .prepare(
      `INSERT INTO dopamine_categories (name, icon, tolerance_rate, is_preset, is_active, sort_order) VALUES (?, ?, ?, 0, 1, ?)`
    )
    .run(cat.name, cat.icon, cat.toleranceRate, maxOrder.next_order);
  return Number(result.lastInsertRowid);
}

export function updateDopamineCategory(cat: { id: number; name?: string; icon?: string; toleranceRate?: number; isActive?: boolean }): void {
  const database = getDb();
  database
    .prepare(
      `UPDATE dopamine_categories SET
         name = COALESCE(?, name), icon = COALESCE(?, icon),
         tolerance_rate = COALESCE(?, tolerance_rate),
         is_active = COALESCE(?, is_active),
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(cat.name ?? null, cat.icon ?? null, cat.toleranceRate ?? null,
      cat.isActive !== undefined ? (cat.isActive ? 1 : 0) : null, cat.id);
}

export function deleteDopamineCategory(id: number): void {
  const database = getDb();
  database.prepare('DELETE FROM dopamine_categories WHERE id = ? AND is_preset = 0').run(id);
}

// ─── Dopamine Logs ──────────────────────────────────────────────────────────

export function startDopamineLog(categoryId: number): number {
  const database = getDb();
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const result = database
    .prepare(`INSERT INTO dopamine_logs (category_id, started_at, date) VALUES (?, ?, ?)`)
    .run(categoryId, now, today);

  // Break any active abstinence timer for this category today
  database
    .prepare(
      `UPDATE abstinence_timers SET broken_at = ?, updated_at = datetime('now')
       WHERE category_id = ? AND date = ? AND broken_at IS NULL AND is_success = 0`
    )
    .run(now, categoryId, today);

  return Number(result.lastInsertRowid);
}

export function stopDopamineLog(logId: number): CamelDopamineLog | null {
  const database = getDb();
  const row = database.prepare('SELECT * FROM dopamine_logs WHERE id = ?').get(logId) as DopamineLogRow | undefined;
  if (!row || row.ended_at) return null;

  const now = new Date().toISOString();
  const durationMin = (new Date(now).getTime() - new Date(row.started_at).getTime()) / (1000 * 60);
  const cat = database.prepare('SELECT tolerance_rate FROM dopamine_categories WHERE id = ?').get(row.category_id) as { tolerance_rate: number } | undefined;
  const rate = cat?.tolerance_rate ?? 0.2;
  const toleranceGain = Math.round(durationMin * rate * 100) / 100;

  database
    .prepare(`UPDATE dopamine_logs SET ended_at = ?, duration_min = ?, tolerance_gain = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(now, Math.round(durationMin * 100) / 100, toleranceGain, logId);

  const settings = database.prepare('SELECT dopamine_tolerance FROM settings WHERE id = 1').get() as { dopamine_tolerance: number };
  const newTolerance = Math.min(100, (settings.dopamine_tolerance ?? 50) + toleranceGain);
  recalcStats(database, newTolerance);

  markDirty('dopamine_logs', logId);
  markDirty('settings', 1);

  return dopamineLogToCamel(database.prepare('SELECT * FROM dopamine_logs WHERE id = ?').get(logId) as DopamineLogRow);
}

export function getActiveDopamineLog(): CamelDopamineLog | null {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM dopamine_logs WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1')
    .get() as DopamineLogRow | undefined;
  return row ? dopamineLogToCamel(row) : null;
}

export function getDopamineLogsForDate(date: string): CamelDopamineLog[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM dopamine_logs WHERE date = ? ORDER BY started_at DESC')
    .all(date) as DopamineLogRow[];
  return rows.map(dopamineLogToCamel);
}

// ─── Abstinence Timers ──────────────────────────────────────────────────────

export function startAbstinenceTimer(categoryId: number): number {
  const database = getDb();
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const existing = database
    .prepare('SELECT id FROM abstinence_timers WHERE category_id = ? AND date = ?')
    .get(categoryId, today) as { id: number } | undefined;
  if (existing) return existing.id;

  const result = database
    .prepare(`INSERT INTO abstinence_timers (category_id, date, started_at) VALUES (?, ?, ?)`)
    .run(categoryId, today, now);
  return Number(result.lastInsertRowid);
}

export function getAbstinenceTimersForDate(date: string): (CamelAbstinenceTimer & { categoryName: string; categoryIcon: string })[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT at.*, dc.name as category_name, dc.icon as category_icon
       FROM abstinence_timers at
       JOIN dopamine_categories dc ON at.category_id = dc.id
       WHERE at.date = ?
       ORDER BY dc.sort_order ASC`
    )
    .all(date) as (AbstinenceTimerRow & { category_name: string; category_icon: string })[];
  return rows.map(row => ({
    ...abstinenceTimerToCamel(row),
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
  }));
}

export function finalizeDay(date: string): void {
  const database = getDb();
  const doFinalize = database.transaction(() => {
    const settings = database.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow & {
      dopamine_tolerance: number; abstinence_streak: number;
    };
    const toleranceStart = settings.dopamine_tolerance ?? 50;

    database.prepare(
      `UPDATE abstinence_timers SET is_success = 1, updated_at = datetime('now') WHERE date = ? AND broken_at IS NULL AND is_success = 0`
    ).run(date);

    const timerStats = database.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_success = 1 THEN 1 ELSE 0 END) as successes FROM abstinence_timers WHERE date = ?`
    ).get(date) as { total: number; successes: number };

    let toleranceChange = 0;
    const logCount = database.prepare('SELECT COUNT(*) as cnt FROM dopamine_logs WHERE date = ?').get(date) as { cnt: number };
    if (logCount.cnt === 0) toleranceChange -= 3;
    toleranceChange -= (timerStats.successes ?? 0) * 2;

    const usageStats = database.prepare(
      'SELECT COALESCE(SUM(duration_min), 0) as total_min FROM dopamine_logs WHERE date = ? AND ended_at IS NOT NULL'
    ).get(date) as { total_min: number };

    const newTolerance = Math.max(0, Math.min(100, toleranceStart + toleranceChange));

    let newStreak = settings.abstinence_streak ?? 0;
    if (timerStats.total > 0 && timerStats.successes === timerStats.total) {
      newStreak += 1;
    } else if (timerStats.total > 0) {
      newStreak = 0;
    }

    database.prepare(
      `INSERT INTO dopamine_daily (date, tolerance_start, tolerance_end, total_usage_min, abstinence_success, abstinence_total)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET tolerance_end = ?, total_usage_min = ?, abstinence_success = ?, abstinence_total = ?, updated_at = datetime('now')`
    ).run(date, toleranceStart, newTolerance, usageStats.total_min, timerStats.successes ?? 0, timerStats.total ?? 0,
      newTolerance, usageStats.total_min, timerStats.successes ?? 0, timerStats.total ?? 0);

    database.prepare(`UPDATE settings SET abstinence_streak = ?, updated_at = datetime('now') WHERE id = 1`).run(newStreak);
    recalcStats(database, newTolerance);
  });
  doFinalize();
}

export function getDopamineDaily(date: string): CamelDopamineDaily | null {
  const database = getDb();
  const row = database.prepare('SELECT * FROM dopamine_daily WHERE date = ?').get(date) as DopamineDailyRow | undefined;
  return row ? dopamineDailyToCamel(row) : null;
}

export function getDopamineDailyRange(days: number): CamelDopamineDaily[] {
  const database = getDb();
  const rows = database.prepare('SELECT * FROM dopamine_daily ORDER BY date DESC LIMIT ?').all(days) as DopamineDailyRow[];
  return rows.map(dopamineDailyToCamel);
}

export { DIFFICULTY_XP, TOLERANCE_STATES, getToleranceState };
