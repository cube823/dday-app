export interface Settings {
  resignationDate: string;
  runwayMonths: number;
  startDate: string | null;
  // Player stats
  playerName: string;
  level: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  // Dopamine stats
  dopamineTolerance: number;
  statWillpower: number;
  statFocus: number;
  abstinenceStreak: number;
}

export interface Quest {
  id: number;
  category: string;
  title: string;
  description: string;
  completed: boolean;
  progress: number;
  order: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'epic';
  xp: number;
  deadline: string | null;
  completedAt: string | null;
}

// Keep backward compatibility alias
export type LearningStep = Quest;

export interface Milestone {
  id: number;
  stepId: number;
  title: string;
  completed: boolean;
  order: number;
}

export interface DailyLog {
  date: string;
  questsCompleted: number;
  xpEarned: number;
}

export interface DopamineCategory {
  id: number;
  name: string;
  icon: string;
  toleranceRate: number;
  isPreset: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface DopamineLog {
  id: number;
  categoryId: number;
  startedAt: string;
  endedAt: string | null;
  durationMin: number | null;
  toleranceGain: number | null;
  date: string;
}

export interface AbstinenceTimer {
  id: number;
  categoryId: number;
  date: string;
  startedAt: string;
  brokenAt: string | null;
  isSuccess: boolean;
  categoryName: string;
  categoryIcon: string;
}

export interface DopamineDaily {
  date: string;
  toleranceStart: number;
  toleranceEnd: number;
  totalUsageMin: number;
  abstinenceSuccess: number;
  abstinenceTotal: number;
}

export interface ToleranceState {
  name: string;
  willpower: number;
  focus: number;
  xpMultiplier: number;
}
