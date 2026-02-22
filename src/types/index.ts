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
