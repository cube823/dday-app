import { DIFFICULTY_XP } from './constants';
import { getDb, markDirty } from './database';
import {
  type SettingsRow, type QuestRow, type MilestoneRow, type DailyLogRow,
  type DopamineCategoryRow, type DopamineLogRow, type AbstinenceTimerRow, type DopamineDailyRow,
  type CamelSettings, type CamelQuest, type CamelMilestone, type CamelDailyLog,
  type CamelDopamineCategory, type CamelDopamineLog, type CamelAbstinenceTimer, type CamelDopamineDaily,
  settingsToCamel, questToCamel, milestoneToCamel, dailyLogToCamel,
  dopamineCategoryToCamel, dopamineLogToCamel, abstinenceTimerToCamel, dopamineDailyToCamel,
  settingsToSnake,
} from './types';

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
  database
    .prepare('DELETE FROM sync_meta WHERE table_name = ? AND local_id = ?')
    .run('quests', id);
  database
    .prepare(
      `DELETE FROM sync_meta WHERE table_name = 'milestones' AND local_id IN (
         SELECT id FROM milestones WHERE quest_id = ?
       )`,
    )
    .run(id);
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

// ─── Dopamine Logs (read-only queries) ──────────────────────────────────────

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

// ─── Abstinence Timers (read-only queries) ──────────────────────────────────

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

// ─── Dopamine Daily ─────────────────────────────────────────────────────────

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
