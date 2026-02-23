import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import {
  getSettings,
  updateSettings,
  getQuests,
  addQuest,
  updateQuest,
  deleteQuest,
  completeQuest,
  getDailyLogs,
  getTodayQuests,
  getMilestones,
  addMilestone,
  updateMilestone,
  deleteMilestone,
} from './database';

// ─── Field mapping helpers ────────────────────────────────────────────────────
// database.ts returns sortOrder; frontend expects order
// database.ts returns questId; frontend expects stepId

interface FrontendQuest {
  id: number;
  category: string;
  title: string;
  description: string;
  completed: boolean;
  progress: number;
  order: number;
  difficulty: string;
  xp: number;
  deadline: string | null;
  completedAt: string | null;
}

interface FrontendMilestone {
  id: number;
  stepId: number;
  title: string;
  completed: boolean;
  order: number;
}

function questToFrontend(q: ReturnType<typeof getQuests>[number]): FrontendQuest {
  const { sortOrder, ...rest } = q;
  return { ...rest, order: sortOrder };
}

function milestoneToFrontend(m: ReturnType<typeof getMilestones>[number]): FrontendMilestone {
  const { questId, sortOrder, ...rest } = m;
  return { ...rest, stepId: questId, order: sortOrder };
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

export function registerIpcHandlers(): void {
  // ── Settings ───────────────────────────────────────────────────────────────

  ipcMain.handle('db:getSettings', () => getSettings());

  ipcMain.handle(
    'db:updateSettings',
    (_event: IpcMainInvokeEvent, settings: Record<string, unknown>) =>
      updateSettings(settings as Parameters<typeof updateSettings>[0]),
  );

  // ── Quests ─────────────────────────────────────────────────────────────────

  ipcMain.handle('db:getQuests', () => getQuests().map(questToFrontend));

  ipcMain.handle(
    'db:addQuest',
    (_event: IpcMainInvokeEvent, quest: Record<string, unknown>) => {
      const { order, ...rest } = quest;
      return addQuest({ ...rest, sortOrder: order as number } as Parameters<typeof addQuest>[0]);
    },
  );

  ipcMain.handle(
    'db:updateQuest',
    (_event: IpcMainInvokeEvent, quest: Record<string, unknown>) => {
      const { order, ...rest } = quest;
      updateQuest({ ...rest, sortOrder: order as number } as Parameters<typeof updateQuest>[0]);
    },
  );

  ipcMain.handle('db:deleteQuest', (_event: IpcMainInvokeEvent, id: number) => deleteQuest(id));

  ipcMain.handle('db:completeQuest', (_event: IpcMainInvokeEvent, id: number) =>
    completeQuest(id),
  );

  // ── Daily Logs ─────────────────────────────────────────────────────────────

  ipcMain.handle('db:getDailyLogs', () => getDailyLogs());

  ipcMain.handle('db:getTodayQuests', () => getTodayQuests().map(questToFrontend));

  // ── Milestones ─────────────────────────────────────────────────────────────

  ipcMain.handle('db:getMilestones', (_event: IpcMainInvokeEvent, stepId: number) =>
    getMilestones(stepId).map(milestoneToFrontend),
  );

  ipcMain.handle(
    'db:addMilestone',
    (_event: IpcMainInvokeEvent, milestone: Record<string, unknown>) => {
      // Frontend sends stepId; addMilestone accepts stepId directly
      return addMilestone(milestone as Parameters<typeof addMilestone>[0]);
    },
  );

  ipcMain.handle(
    'db:updateMilestone',
    (_event: IpcMainInvokeEvent, milestone: Record<string, unknown>) => {
      const { order, stepId, ...rest } = milestone;
      updateMilestone({
        ...rest,
        sortOrder: order as number,
        questId: stepId as number,
      } as Parameters<typeof updateMilestone>[0]);
    },
  );

  ipcMain.handle('db:deleteMilestone', (_event: IpcMainInvokeEvent, id: number) =>
    deleteMilestone(id),
  );
}
