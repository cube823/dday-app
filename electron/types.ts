// ─── Row Interfaces (snake_case, DB layer) ───────────────────────────────────

export interface SettingsRow {
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

export interface QuestRow {
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

export interface MilestoneRow {
  id: number;
  quest_id: number;
  title: string;
  completed: number;
  sort_order: number;
  updated_at: string;
}

export interface DailyLogRow {
  date: string;
  quests_completed: number;
  xp_earned: number;
  updated_at: string;
}

export interface DopamineCategoryRow {
  id: number;
  name: string;
  icon: string;
  tolerance_rate: number;
  is_preset: number;
  is_active: number;
  sort_order: number;
  updated_at: string;
}

export interface DopamineLogRow {
  id: number;
  category_id: number;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  tolerance_gain: number | null;
  date: string;
  updated_at: string;
}

export interface AbstinenceTimerRow {
  id: number;
  category_id: number;
  date: string;
  started_at: string;
  broken_at: string | null;
  is_success: number;
  updated_at: string;
}

export interface DopamineDailyRow {
  date: string;
  tolerance_start: number;
  tolerance_end: number;
  total_usage_min: number;
  abstinence_success: number;
  abstinence_total: number;
  updated_at: string;
}

// ─── Camel Interfaces (camelCase, API layer) ─────────────────────────────────

export interface CamelSettings {
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

export interface CamelQuest {
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

export interface CamelMilestone {
  id: number;
  questId: number;
  title: string;
  completed: boolean;
  sortOrder: number;
}

export interface CamelDailyLog {
  date: string;
  questsCompleted: number;
  xpEarned: number;
}

export interface CamelDopamineCategory {
  id: number;
  name: string;
  icon: string;
  toleranceRate: number;
  isPreset: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CamelDopamineLog {
  id: number;
  categoryId: number;
  startedAt: string;
  endedAt: string | null;
  durationMin: number | null;
  toleranceGain: number | null;
  date: string;
}

export interface CamelAbstinenceTimer {
  id: number;
  categoryId: number;
  date: string;
  startedAt: string;
  brokenAt: string | null;
  isSuccess: boolean;
}

export interface CamelDopamineDaily {
  date: string;
  toleranceStart: number;
  toleranceEnd: number;
  totalUsageMin: number;
  abstinenceSuccess: number;
  abstinenceTotal: number;
}

export interface CompleteQuestResult {
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
export interface JsonDatabase {
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

// ─── snake_case <-> camelCase 변환 헬퍼 ──────────────────────────────────────

export function settingsToCamel(row: SettingsRow): CamelSettings {
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

export function questToCamel(row: QuestRow): CamelQuest {
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

export function milestoneToCamel(row: MilestoneRow): CamelMilestone {
  return {
    id: row.id,
    questId: row.quest_id,
    title: row.title,
    completed: Boolean(row.completed),
    sortOrder: row.sort_order,
  };
}

export function dailyLogToCamel(row: DailyLogRow): CamelDailyLog {
  return {
    date: row.date,
    questsCompleted: row.quests_completed,
    xpEarned: row.xp_earned,
  };
}

export function dopamineCategoryToCamel(row: DopamineCategoryRow): CamelDopamineCategory {
  return {
    id: row.id, name: row.name, icon: row.icon,
    toleranceRate: row.tolerance_rate,
    isPreset: Boolean(row.is_preset),
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
  };
}

export function dopamineLogToCamel(row: DopamineLogRow): CamelDopamineLog {
  return {
    id: row.id, categoryId: row.category_id,
    startedAt: row.started_at, endedAt: row.ended_at,
    durationMin: row.duration_min, toleranceGain: row.tolerance_gain,
    date: row.date,
  };
}

export function abstinenceTimerToCamel(row: AbstinenceTimerRow): CamelAbstinenceTimer {
  return {
    id: row.id, categoryId: row.category_id,
    date: row.date, startedAt: row.started_at,
    brokenAt: row.broken_at, isSuccess: Boolean(row.is_success),
  };
}

export function dopamineDailyToCamel(row: DopamineDailyRow): CamelDopamineDaily {
  return {
    date: row.date, toleranceStart: row.tolerance_start,
    toleranceEnd: row.tolerance_end, totalUsageMin: row.total_usage_min,
    abstinenceSuccess: row.abstinence_success, abstinenceTotal: row.abstinence_total,
  };
}

/** camelCase 설정 객체를 snake_case 컬럼 매핑으로 변환 */
export function settingsToSnake(
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
