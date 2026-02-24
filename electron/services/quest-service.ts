import { DIFFICULTY_XP, QUEST_TOLERANCE_REDUCTION } from '../constants';
import { getDb, markDirty } from '../database';
import type { QuestRow, SettingsRow, CompleteQuestResult } from '../types';
import { recalcStats } from './stats-helper';

/** 레벨 계산: 각 레벨마다 level * 150 XP 필요 (누적) */
function calculateLevel(totalXp: number): number {
  let totalXpNeeded = 0;
  let level = 1;
  while (true) {
    totalXpNeeded += level * 150;
    if (totalXp < totalXpNeeded) break;
    level++;
  }
  return level;
}

/** 스트릭 계산 */
function calculateStreak(currentStreak: number, lastActiveDate: string | null, today: string): number {
  if (!lastActiveDate) {
    return 1;
  }
  if (lastActiveDate === today) {
    return currentStreak;
  }
  const lastDate = new Date(lastActiveDate);
  const todayDate = new Date(today);
  const diffMs = todayDate.getTime() - lastDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return currentStreak + 1;
  }
  return 1;
}

/**
 * 퀘스트 완료 처리 (트랜잭션).
 *
 * 1. 퀘스트 completed=1, progress=100, completed_at=today
 * 2. XP 부여
 * 3. 레벨 재계산
 * 4. 스트릭 업데이트
 * 5. 내성 감소
 * 6. daily_log upsert
 * 7. sync_meta dirty 마킹
 */
export function completeQuest(id: number): CompleteQuestResult | null {
  const database = getDb();

  const doComplete = database.transaction((): CompleteQuestResult | null => {
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

    // 3. 레벨 재계산
    const oldLevel = settingsRow.level;
    const newLevel = calculateLevel(newTotalXp);
    const leveledUp = newLevel > oldLevel;

    // 4. 스트릭 업데이트
    const currentStreak = calculateStreak(settingsRow.current_streak, settingsRow.last_active_date, today);
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

    // 5. 내성 감소
    const toleranceReduction = QUEST_TOLERANCE_REDUCTION[quest.difficulty] ?? -3;
    const currentTolerance = settingsRow.dopamine_tolerance ?? 50;
    recalcStats(database, Math.max(0, currentTolerance + toleranceReduction));

    // 6. daily_log upsert
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

    // 7. sync_meta dirty 마킹
    markDirty('settings', 1);
    markDirty('quests', id);
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
