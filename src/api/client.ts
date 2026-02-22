import { Settings, Quest, Milestone, DailyLog } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

// Settings API
export async function getSettings(): Promise<Settings> {
  return fetchAPI<Settings>('/settings');
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  await fetchAPI('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// Quest / Learning Steps API
export async function getQuests(): Promise<Quest[]> {
  return fetchAPI<Quest[]>('/learning-steps');
}

// Backward compatibility alias
export const getLearningSteps = getQuests;

export async function addQuest(quest: Partial<Quest>): Promise<number> {
  const result = await fetchAPI<{ id: number }>('/learning-steps', {
    method: 'POST',
    body: JSON.stringify(quest),
  });
  return result.id;
}

export const addLearningStep = addQuest;

export async function updateQuest(quest: Quest): Promise<void> {
  await fetchAPI(`/learning-steps/${quest.id}`, {
    method: 'PUT',
    body: JSON.stringify(quest),
  });
}

export const updateLearningStep = updateQuest;

export async function deleteQuest(id: number): Promise<void> {
  await fetchAPI(`/learning-steps/${id}`, {
    method: 'DELETE',
  });
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
  return fetchAPI<CompleteQuestResult>(`/complete-quest/${id}`, {
    method: 'POST',
  });
}

// Daily logs
export async function getDailyLogs(): Promise<DailyLog[]> {
  return fetchAPI<DailyLog[]>('/daily-logs');
}

// Today's quests
export async function getTodayQuests(): Promise<Quest[]> {
  return fetchAPI<Quest[]>('/today');
}

// Milestones API
export async function getMilestones(stepId: number): Promise<Milestone[]> {
  return fetchAPI<Milestone[]>(`/milestones/${stepId}`);
}

export async function addMilestone(milestone: Omit<Milestone, 'id'>): Promise<number> {
  const result = await fetchAPI<{ id: number }>('/milestones', {
    method: 'POST',
    body: JSON.stringify(milestone),
  });
  return result.id;
}

export async function updateMilestone(milestone: Milestone): Promise<void> {
  await fetchAPI(`/milestones/${milestone.id}`, {
    method: 'PUT',
    body: JSON.stringify(milestone),
  });
}

export async function deleteMilestone(id: number): Promise<void> {
  await fetchAPI(`/milestones/${id}`, {
    method: 'DELETE',
  });
}
