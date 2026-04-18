import Database from 'better-sqlite3';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';

import { DIFFICULTY_XP } from './constants';
import type { JsonDatabase } from './types';

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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
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

// ─── Singleton ───────────────────────────────────────────────────────────────

let db: Database.Database | null = null;

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

  // 기존 퀘스트 테이블에 created_at 컬럼이 없는 경우 마이그레이션
  migrateQuestCreatedAt();

  // JSON 파일에서 마이그레이션
  migrateFromJson();

  // 도파민 카테고리 기본값 시드
  seedDopamineCategories();
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

// ─── Migrations ──────────────────────────────────────────────────────────────

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

/** 기존 quests 테이블에 created_at 컬럼이 없으면 추가 */
function migrateQuestCreatedAt(): void {
  const database = getDb();
  const columns = database.pragma('table_info(quests)') as Array<{ name: string }>;
  const colNames = columns.map(c => c.name);

  if (!colNames.includes('created_at')) {
    database.exec(
      `ALTER TABLE quests ADD COLUMN created_at TEXT NOT NULL DEFAULT (datetime('now'))`,
    );
  }
}

/**
 * 기존 dday-data.json 파일에서 SQLite로 데이터 마이그레이션.
 * SQLite에 데이터가 없는 경우에만 실행.
 */
function migrateFromJson(): void {
  const database = getDb();

  const existing = database.prepare('SELECT COUNT(*) as cnt FROM settings').get() as { cnt: number };
  if (existing.cnt > 0) return;

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

  const migrate = database.transaction(() => {
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
