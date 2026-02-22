import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import fs from 'fs';
import path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DbSettings {
  resignation_date: string;
  runway_months: number;
  start_date: string | null;
  player_name: string;
  level: number;
  total_xp: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
}

interface DbLearningStep {
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
}

interface DbMilestone {
  id: number;
  step_id: number;
  title: string;
  completed: number;
  order: number;
}

interface DbDailyLog {
  date: string;
  quests_completed: number;
  xp_earned: number;
}

interface Database {
  settings: DbSettings;
  learning_steps: DbLearningStep[];
  milestones: DbMilestone[];
  daily_logs: DbDailyLog[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DIFFICULTY_XP: Record<string, number> = {
  easy: 50,
  normal: 100,
  hard: 200,
  epic: 500,
};

// ─── DB Layer ────────────────────────────────────────────────────────────────

function getJsonPath(): string {
  return path.join(app.getPath('userData'), 'dday-data.json');
}

function getDefaultDatabase(): Database {
  const defaultDate = new Date();
  defaultDate.setFullYear(defaultDate.getFullYear() + 1);

  return {
    settings: {
      resignation_date: defaultDate.toISOString().split('T')[0],
      runway_months: 12,
      start_date: null,
      player_name: '\uBAA8\uD5D8\uAC00',
      level: 1,
      total_xp: 0,
      current_streak: 0,
      longest_streak: 0,
      last_active_date: null,
    },
    learning_steps: [
      {
        id: 1,
        category: '\uBE14\uB85C\uADF8/\uCF58\uD150\uCE20',
        title: '\uBE14\uB85C\uADF8 \uAE00\uC4F0\uAE30',
        description: '\uAE30\uC220 \uBE14\uB85C\uADF8 \uC6B4\uC601 \uBC0F \uCF58\uD150\uCE20 \uC81C\uC791 \uB2A5\uB825 \uD5A5\uC0C1',
        completed: 0,
        progress: 0,
        order: 1,
        difficulty: 'normal',
        xp: 100,
        deadline: null,
        completed_at: null,
      },
      {
        id: 2,
        category: 'YouTube',
        title: 'YouTube \uCF58\uD150\uCE20 \uC81C\uC791',
        description: '\uC601\uC0C1 \uAE30\uD68D, \uCD2C\uC601, \uD3B8\uC9D1 \uB2A5\uB825 \uC2B5\uB4DD',
        completed: 0,
        progress: 0,
        order: 2,
        difficulty: 'normal',
        xp: 100,
        deadline: null,
        completed_at: null,
      },
      {
        id: 3,
        category: '\uBE14\uB85D\uCCB4\uC778/Web3',
        title: '\uBE14\uB85D\uCCB4\uC778 \uAC1C\uBC1C',
        description: 'Web3 \uBC0F \uC2A4\uB9C8\uD2B8 \uCEE8\uD2B8\uB799\uD2B8 \uAC1C\uBC1C \uC5ED\uB7C9 \uAC15\uD654',
        completed: 0,
        progress: 0,
        order: 3,
        difficulty: 'hard',
        xp: 200,
        deadline: null,
        completed_at: null,
      },
      {
        id: 4,
        category: 'Ethereum',
        title: 'Ethereum \uC0DD\uD0DC\uACC4 \uD65C\uB3D9',
        description: 'DApp \uAC1C\uBC1C \uBC0F \uC774\uB354\uB9AC\uC6C0 \uC0DD\uD0DC\uACC4 \uCC38\uC5EC',
        completed: 0,
        progress: 0,
        order: 4,
        difficulty: 'hard',
        xp: 200,
        deadline: null,
        completed_at: null,
      },
    ],
    milestones: [],
    daily_logs: [],
  };
}

function writeDatabase(data: Database): void {
  const jsonPath = getJsonPath();
  const dir = path.dirname(jsonPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
}

function migrateDatabase(db: Database): Database {
  let changed = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = db.settings as any;
  if (settings.player_name === undefined) {
    db.settings.player_name = '\uBAA8\uD5D8\uAC00';
    db.settings.level = 1;
    db.settings.total_xp = 0;
    db.settings.current_streak = 0;
    db.settings.longest_streak = 0;
    db.settings.last_active_date = null;
    changed = true;
  }

  for (let i = 0; i < db.learning_steps.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = db.learning_steps[i] as any;
    if (raw.difficulty === undefined) {
      raw.difficulty = 'normal';
      raw.xp = DIFFICULTY_XP['normal'];
      raw.deadline = null;
      raw.completed_at = null;
      changed = true;
    }
  }

  if (!db.daily_logs) {
    db.daily_logs = [];
    changed = true;
  }

  if (changed) {
    writeDatabase(db);
  }

  return db;
}

function readDatabase(): Database {
  const jsonPath = getJsonPath();

  if (!fs.existsSync(jsonPath)) {
    // Try to migrate from old data/ folder
    const oldPath = path.join(process.cwd(), 'data', 'dday-data.json');
    if (fs.existsSync(oldPath)) {
      try {
        const data = fs.readFileSync(oldPath, 'utf-8');
        const db: Database = JSON.parse(data);
        const migrated = migrateDatabase(db);
        writeDatabase(migrated);
        return migrated;
      } catch {
        // Fall through to default
      }
    }
    const defaultDb = getDefaultDatabase();
    writeDatabase(defaultDb);
    return defaultDb;
  }

  try {
    const data = fs.readFileSync(jsonPath, 'utf-8');
    const db: Database = JSON.parse(data);
    return migrateDatabase(db);
  } catch {
    const defaultDb = getDefaultDatabase();
    writeDatabase(defaultDb);
    return defaultDb;
  }
}

function getNextId(items: { id: number }[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((item) => item.id)) + 1;
}

// ─── snake_case → camelCase helpers (matches api.js transform) ───────────────

function settingsToCamel(s: DbSettings) {
  return {
    resignationDate: s.resignation_date,
    runwayMonths: s.runway_months,
    startDate: s.start_date,
    playerName: s.player_name,
    level: s.level,
    totalXp: s.total_xp,
    currentStreak: s.current_streak,
    longestStreak: s.longest_streak,
    lastActiveDate: s.last_active_date,
  };
}

function stepToCamel(step: DbLearningStep) {
  return {
    id: step.id,
    category: step.category,
    title: step.title,
    description: step.description,
    completed: Boolean(step.completed),
    progress: step.progress,
    order: step.order,
    difficulty: step.difficulty || 'normal',
    xp: step.xp || 100,
    deadline: step.deadline || null,
    completedAt: step.completed_at || null,
  };
}

function milestoneToCamel(m: DbMilestone) {
  return {
    id: m.id,
    stepId: m.step_id,
    title: m.title,
    completed: Boolean(m.completed),
    order: m.order,
  };
}

function dailyLogToCamel(log: DbDailyLog) {
  return {
    date: log.date,
    questsCompleted: log.quests_completed,
    xpEarned: log.xp_earned,
  };
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

export function registerIpcHandlers(): void {
  // ── Settings ───────────────────────────────────────────────────────────────

  ipcMain.handle('db:getSettings', () => {
    const db = readDatabase();
    return settingsToCamel(db.settings);
  });

  ipcMain.handle(
    'db:updateSettings',
    (_event: IpcMainInvokeEvent, settings: Record<string, unknown>) => {
      const db = readDatabase();
      const update: Record<string, unknown> = {};
      if (settings.resignationDate !== undefined)
        update.resignation_date = settings.resignationDate;
      if (settings.runwayMonths !== undefined)
        update.runway_months = settings.runwayMonths;
      if (settings.startDate !== undefined)
        update.start_date = settings.startDate;
      if (settings.playerName !== undefined)
        update.player_name = settings.playerName;

      db.settings = { ...db.settings, ...(update as Partial<DbSettings>) };
      writeDatabase(db);
    },
  );

  // ── Quests (Learning Steps) ────────────────────────────────────────────────

  ipcMain.handle('db:getQuests', () => {
    const db = readDatabase();
    const steps = db.learning_steps.sort((a, b) => a.order - b.order);
    return steps.map(stepToCamel);
  });

  ipcMain.handle(
    'db:addQuest',
    (_event: IpcMainInvokeEvent, quest: Record<string, unknown>) => {
      const db = readDatabase();
      const newId = getNextId(db.learning_steps);
      const difficulty = (quest.difficulty as string) || 'normal';

      const newStep: DbLearningStep = {
        id: newId,
        category: quest.category as string,
        title: quest.title as string,
        description: quest.description as string,
        completed: 0,
        progress: 0,
        order: quest.order as number,
        difficulty,
        xp: DIFFICULTY_XP[difficulty] || 100,
        deadline: (quest.deadline as string) || null,
        completed_at: null,
      };

      db.learning_steps.push(newStep);
      writeDatabase(db);
      return newId;
    },
  );

  ipcMain.handle(
    'db:updateQuest',
    (_event: IpcMainInvokeEvent, quest: Record<string, unknown>) => {
      const db = readDatabase();
      const id = quest.id as number;
      const index = db.learning_steps.findIndex((s) => s.id === id);

      if (index !== -1) {
        const existing = db.learning_steps[index];
        const difficulty =
          (quest.difficulty as string) || existing.difficulty || 'normal';

        db.learning_steps[index] = {
          id,
          category: quest.category as string,
          title: quest.title as string,
          description: quest.description as string,
          completed: quest.completed ? 1 : 0,
          progress: quest.progress as number,
          order: quest.order as number,
          difficulty,
          xp: DIFFICULTY_XP[difficulty] || 100,
          deadline:
            quest.deadline !== undefined
              ? (quest.deadline as string | null)
              : existing.deadline,
          completed_at:
            quest.completedAt !== undefined
              ? (quest.completedAt as string | null)
              : existing.completed_at,
        };
        writeDatabase(db);
      }
    },
  );

  ipcMain.handle('db:deleteQuest', (_event: IpcMainInvokeEvent, id: number) => {
    const db = readDatabase();
    db.learning_steps = db.learning_steps.filter((s) => s.id !== id);
    db.milestones = db.milestones.filter((m) => m.step_id !== id);
    writeDatabase(db);
  });

  ipcMain.handle('db:completeQuest', (_event: IpcMainInvokeEvent, id: number) => {
    const db = readDatabase();
    const index = db.learning_steps.findIndex((s) => s.id === id);

    if (index === -1) return null;

    const quest = db.learning_steps[index];
    if (quest.completed) return null;

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Mark quest completed
    quest.completed = 1;
    quest.progress = 100;
    quest.completed_at = today;

    // Award XP
    const xpEarned = quest.xp || DIFFICULTY_XP[quest.difficulty] || 100;
    db.settings.total_xp += xpEarned;

    // Calculate level (level * 150 XP needed per level)
    const oldLevel = db.settings.level;
    let totalXpNeeded = 0;
    let newLevel = 1;
    while (true) {
      totalXpNeeded += newLevel * 150;
      if (db.settings.total_xp < totalXpNeeded) break;
      newLevel++;
    }
    db.settings.level = newLevel;
    const leveledUp = newLevel > oldLevel;

    // Update streak
    const lastActive = db.settings.last_active_date;
    if (!lastActive || lastActive === today) {
      if (!lastActive) {
        db.settings.current_streak = 1;
      }
    } else {
      const lastDate = new Date(lastActive);
      const todayDate = new Date(today);
      const diffMs = todayDate.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        db.settings.current_streak += 1;
      } else {
        db.settings.current_streak = 1;
      }
    }
    db.settings.last_active_date = today;
    if (db.settings.current_streak > db.settings.longest_streak) {
      db.settings.longest_streak = db.settings.current_streak;
    }

    // Update daily log
    const logIndex = db.daily_logs.findIndex((l) => l.date === today);
    if (logIndex !== -1) {
      db.daily_logs[logIndex].quests_completed += 1;
      db.daily_logs[logIndex].xp_earned += xpEarned;
    } else {
      db.daily_logs.push({
        date: today,
        quests_completed: 1,
        xp_earned: xpEarned,
      });
    }

    writeDatabase(db);

    return {
      xpEarned,
      totalXp: db.settings.total_xp,
      level: db.settings.level,
      leveledUp,
      oldLevel,
      newLevel,
      currentStreak: db.settings.current_streak,
      longestStreak: db.settings.longest_streak,
    };
  });

  // ── Daily Logs ─────────────────────────────────────────────────────────────

  ipcMain.handle('db:getDailyLogs', () => {
    const db = readDatabase();
    const logs = db.daily_logs
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);
    return logs.map(dailyLogToCamel);
  });

  // ── Today's Quests ─────────────────────────────────────────────────────────

  ipcMain.handle('db:getTodayQuests', () => {
    const db = readDatabase();

    const incomplete = db.learning_steps.filter((s) => !s.completed);

    incomplete.sort((a, b) => {
      const aDeadline = a.deadline;
      const bDeadline = b.deadline;

      if (aDeadline && !bDeadline) return -1;
      if (!aDeadline && bDeadline) return 1;

      if (aDeadline && bDeadline) {
        return aDeadline.localeCompare(bDeadline);
      }

      return b.progress - a.progress;
    });

    return incomplete.slice(0, 3).map(stepToCamel);
  });

  // ── Milestones ─────────────────────────────────────────────────────────────

  ipcMain.handle('db:getMilestones', (_event: IpcMainInvokeEvent, stepId: number) => {
    const db = readDatabase();
    const milestones = db.milestones
      .filter((m) => m.step_id === stepId)
      .sort((a, b) => a.order - b.order);
    return milestones.map(milestoneToCamel);
  });

  ipcMain.handle(
    'db:addMilestone',
    (_event: IpcMainInvokeEvent, milestone: Record<string, unknown>) => {
      const db = readDatabase();
      const newId = getNextId(db.milestones);

      const newMilestone: DbMilestone = {
        id: newId,
        step_id: milestone.stepId as number,
        title: milestone.title as string,
        completed: 0,
        order: milestone.order as number,
      };

      db.milestones.push(newMilestone);
      writeDatabase(db);
      return newId;
    },
  );

  ipcMain.handle(
    'db:updateMilestone',
    (_event: IpcMainInvokeEvent, milestone: Record<string, unknown>) => {
      const db = readDatabase();
      const id = milestone.id as number;
      const index = db.milestones.findIndex((m) => m.id === id);

      if (index !== -1) {
        db.milestones[index] = {
          ...db.milestones[index],
          title: milestone.title as string,
          completed: milestone.completed ? 1 : 0,
          order: milestone.order as number,
        };
        writeDatabase(db);
      }
    },
  );

  ipcMain.handle('db:deleteMilestone', (_event: IpcMainInvokeEvent, id: number) => {
    const db = readDatabase();
    db.milestones = db.milestones.filter((m) => m.id !== id);
    writeDatabase(db);
  });
}
