import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('db:getSettings'),
  updateSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('db:updateSettings', settings),

  // Quests
  getQuests: () => ipcRenderer.invoke('db:getQuests'),
  addQuest: (quest: Record<string, unknown>) =>
    ipcRenderer.invoke('db:addQuest', quest),
  updateQuest: (quest: Record<string, unknown>) =>
    ipcRenderer.invoke('db:updateQuest', quest),
  deleteQuest: (id: number) => ipcRenderer.invoke('db:deleteQuest', id),
  completeQuest: (id: number) => ipcRenderer.invoke('db:completeQuest', id),

  // Daily logs
  getDailyLogs: () => ipcRenderer.invoke('db:getDailyLogs'),
  getTodayQuests: () => ipcRenderer.invoke('db:getTodayQuests'),

  // Milestones
  getMilestones: (stepId: number) =>
    ipcRenderer.invoke('db:getMilestones', stepId),
  addMilestone: (milestone: Record<string, unknown>) =>
    ipcRenderer.invoke('db:addMilestone', milestone),
  updateMilestone: (milestone: Record<string, unknown>) =>
    ipcRenderer.invoke('db:updateMilestone', milestone),
  deleteMilestone: (id: number) =>
    ipcRenderer.invoke('db:deleteMilestone', id),
});
