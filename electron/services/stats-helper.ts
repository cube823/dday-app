import Database from 'better-sqlite3';
import { getToleranceState } from '../constants';

/** 내성에 따른 스탯(의지력, 집중력) 재계산 및 DB 업데이트 */
export function recalcStats(database: Database.Database, tolerance: number): void {
  const state = getToleranceState(tolerance);
  database
    .prepare(
      `UPDATE settings SET dopamine_tolerance = ?, stat_willpower = ?, stat_focus = ?, updated_at = datetime('now') WHERE id = 1`
    )
    .run(Math.max(0, Math.min(100, tolerance)), state.willpower, state.focus);
}
