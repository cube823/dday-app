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

  // Auth: 회원가입
  signUp: (email: string, password: string) =>
    ipcRenderer.invoke('auth:signUp', { email, password }),

  // Auth: 이메일/비밀번호 로그인
  signIn: (email: string, password: string) =>
    ipcRenderer.invoke('auth:signIn', { email, password }),

  // Auth: OAuth 로그인 (Google, GitHub 등)
  signInWithOAuth: (provider: string) =>
    ipcRenderer.invoke('auth:signInWithOAuth', provider),

  // Auth: 로그아웃
  signOut: () => ipcRenderer.invoke('auth:signOut'),

  // Auth: 현재 세션 조회
  getSession: () => ipcRenderer.invoke('auth:getSession'),

  // Auth: 현재 사용자 조회
  getUser: () => ipcRenderer.invoke('auth:getUser'),

  // Auth: Supabase 설정 여부 확인
  isSupabaseConfigured: () => ipcRenderer.invoke('auth:isConfigured'),

  // Auth: Supabase 초기화
  initSupabase: (url: string, anonKey: string) =>
    ipcRenderer.invoke('auth:initSupabase', { url, anonKey }),

  // Sync: 동기화 시작
  startSync: () => ipcRenderer.invoke('sync:start'),

  // Sync: 동기화 중지
  stopSync: () => ipcRenderer.invoke('sync:stop'),

  // Sync: 즉시 전체 동기화 실행
  syncNow: () => ipcRenderer.invoke('sync:now'),

  // Sync: 동기화 상태 조회
  getSyncStatus: () => ipcRenderer.invoke('sync:status'),

  // Dopamine Categories
  getDopamineCategories: () => ipcRenderer.invoke('dopamine:getCategories'),
  addDopamineCategory: (cat: Record<string, unknown>) =>
    ipcRenderer.invoke('dopamine:addCategory', cat),
  updateDopamineCategory: (cat: Record<string, unknown>) =>
    ipcRenderer.invoke('dopamine:updateCategory', cat),
  deleteDopamineCategory: (id: number) =>
    ipcRenderer.invoke('dopamine:deleteCategory', id),

  // Dopamine Logs
  startDopamineLog: (categoryId: number) =>
    ipcRenderer.invoke('dopamine:startLog', categoryId),
  stopDopamineLog: (logId: number) =>
    ipcRenderer.invoke('dopamine:stopLog', logId),
  getActiveDopamineLog: () => ipcRenderer.invoke('dopamine:getActiveLog'),
  getDopamineLogsForDate: (date: string) =>
    ipcRenderer.invoke('dopamine:getLogsForDate', date),

  // Abstinence Timers
  startAbstinenceTimer: (categoryId: number) =>
    ipcRenderer.invoke('dopamine:startAbstinence', categoryId),
  getAbstinenceTimersForDate: (date: string) =>
    ipcRenderer.invoke('dopamine:getAbstinenceTimers', date),
  finalizeDay: (date: string) =>
    ipcRenderer.invoke('dopamine:finalizeDay', date),

  // Dopamine Daily
  getDopamineDaily: (date: string) =>
    ipcRenderer.invoke('dopamine:getDaily', date),
  getDopamineDailyRange: (days: number) =>
    ipcRenderer.invoke('dopamine:getDailyRange', days),
});
