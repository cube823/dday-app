import { Settings, Quest, Milestone, DailyLog } from '../types';

// Electron IPC bridge type
declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<Settings>;
      updateSettings: (settings: Partial<Settings>) => Promise<void>;
      getQuests: () => Promise<Quest[]>;
      addQuest: (quest: Partial<Quest>) => Promise<number>;
      updateQuest: (quest: Quest) => Promise<void>;
      deleteQuest: (id: number) => Promise<void>;
      completeQuest: (id: number) => Promise<CompleteQuestResult>;
      getDailyLogs: () => Promise<DailyLog[]>;
      getTodayQuests: () => Promise<Quest[]>;
      getMilestones: (stepId: number) => Promise<Milestone[]>;
      addMilestone: (milestone: Omit<Milestone, 'id'>) => Promise<number>;
      updateMilestone: (milestone: Milestone) => Promise<void>;
      deleteMilestone: (id: number) => Promise<void>;
    };
  }
}

// Settings API
export async function getSettings(): Promise<Settings> {
  return window.electronAPI.getSettings();
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  await window.electronAPI.updateSettings(settings);
}

// Quest / Learning Steps API
export async function getQuests(): Promise<Quest[]> {
  return window.electronAPI.getQuests();
}

// Backward compatibility alias
export const getLearningSteps = getQuests;

export async function addQuest(quest: Partial<Quest>): Promise<number> {
  return window.electronAPI.addQuest(quest);
}

export const addLearningStep = addQuest;

export async function updateQuest(quest: Quest): Promise<void> {
  await window.electronAPI.updateQuest(quest);
}

export const updateLearningStep = updateQuest;

export async function deleteQuest(id: number): Promise<void> {
  await window.electronAPI.deleteQuest(id);
}

export const deleteLearningStep = deleteQuest;

// Complete quest (XP + level + streak)
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

export async function completeQuest(id: number): Promise<CompleteQuestResult> {
  return window.electronAPI.completeQuest(id);
}

// Daily logs
export async function getDailyLogs(): Promise<DailyLog[]> {
  return window.electronAPI.getDailyLogs();
}

// Today's quests
export async function getTodayQuests(): Promise<Quest[]> {
  return window.electronAPI.getTodayQuests();
}

// Milestones API
export async function getMilestones(stepId: number): Promise<Milestone[]> {
  return window.electronAPI.getMilestones(stepId);
}

export async function addMilestone(milestone: Omit<Milestone, 'id'>): Promise<number> {
  return window.electronAPI.addMilestone(milestone);
}

export async function updateMilestone(milestone: Milestone): Promise<void> {
  await window.electronAPI.updateMilestone(milestone);
}

export async function deleteMilestone(id: number): Promise<void> {
  await window.electronAPI.deleteMilestone(id);
}
