import { Settings, Quest, Milestone, DailyLog } from '../types';

export interface AuthResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface SyncStatus {
  lastSyncedAt: string | null;
  pendingChanges: number;
  isOnline: boolean;
  isSyncing: boolean;
}

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
      // Auth
      signUp: (email: string, password: string) => Promise<AuthResponse>;
      signIn: (email: string, password: string) => Promise<AuthResponse>;
      signInWithOAuth: (provider: string) => Promise<AuthResponse>;
      signOut: () => Promise<AuthResponse>;
      getSession: () => Promise<AuthResponse>;
      getUser: () => Promise<AuthResponse>;
      isSupabaseConfigured: () => Promise<AuthResponse>;
      initSupabase: (url: string, anonKey: string) => Promise<AuthResponse>;
      // Sync
      startSync: () => Promise<void>;
      stopSync: () => Promise<void>;
      syncNow: () => Promise<void>;
      getSyncStatus: () => Promise<SyncStatus>;
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

// Auth API
export async function authSignUp(email: string, password: string): Promise<AuthResponse> {
  return window.electronAPI.signUp(email, password);
}

export async function authSignIn(email: string, password: string): Promise<AuthResponse> {
  return window.electronAPI.signIn(email, password);
}

export async function authSignInWithOAuth(provider: string): Promise<AuthResponse> {
  return window.electronAPI.signInWithOAuth(provider);
}

export async function authSignOut(): Promise<AuthResponse> {
  return window.electronAPI.signOut();
}

export async function authGetSession(): Promise<AuthResponse> {
  return window.electronAPI.getSession();
}

export async function authGetUser(): Promise<AuthResponse> {
  return window.electronAPI.getUser();
}

export async function authIsConfigured(): Promise<AuthResponse> {
  return window.electronAPI.isSupabaseConfigured();
}

export async function authInitSupabase(url: string, anonKey: string): Promise<AuthResponse> {
  return window.electronAPI.initSupabase(url, anonKey);
}

// Sync API
export async function syncStart(): Promise<void> {
  await window.electronAPI.startSync();
}

export async function syncStop(): Promise<void> {
  await window.electronAPI.stopSync();
}

export async function syncNow(): Promise<void> {
  await window.electronAPI.syncNow();
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return window.electronAPI.getSyncStatus();
}
