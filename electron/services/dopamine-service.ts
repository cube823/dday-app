import { getDb, markDirty } from '../database';
import type { DopamineLogRow, SettingsRow, CamelDopamineLog } from '../types';
import { dopamineLogToCamel } from '../types';
import { recalcStats } from './stats-helper';

/** 도파민 로그 시작 + 해당 카테고리의 금욕 타이머 해제 */
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

/** 도파민 로그 종료, duration/tolerance 계산, 스탯 재계산 */
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

/** 금욕 타이머 시작 (중복 방지: 동일 카테고리+날짜에 기존 타이머 있으면 해당 id 반환) */
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

/** 일일 마감: 금욕 판정, 내성 계산, 일일 기록 생성 (트랜잭션) */
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
