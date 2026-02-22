import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use project root for data storage
const dataPath = path.join(__dirname, '..', 'data');
const jsonPath = path.join(dataPath, 'dday-data.json');

// Ensure the directory exists
fs.mkdirSync(dataPath, { recursive: true });

// XP by difficulty
const DIFFICULTY_XP = { easy: 50, normal: 100, hard: 200, epic: 500 };

// Read JSON database
function readDatabase() {
  if (!fs.existsSync(jsonPath)) {
    return getDefaultDatabase();
  }

  try {
    const data = fs.readFileSync(jsonPath, 'utf-8');
    const db = JSON.parse(data);
    return migrateDatabase(db);
  } catch (error) {
    console.error('Error reading database:', error);
    return getDefaultDatabase();
  }
}

// Migrate existing data to new schema
function migrateDatabase(db) {
  let changed = false;

  // Migrate settings
  if (db.settings.player_name === undefined) {
    db.settings.player_name = '모험가';
    db.settings.level = 1;
    db.settings.total_xp = 0;
    db.settings.current_streak = 0;
    db.settings.longest_streak = 0;
    db.settings.last_active_date = null;
    changed = true;
  }

  // Migrate learning_steps
  for (const step of db.learning_steps) {
    if (step.difficulty === undefined) {
      step.difficulty = 'normal';
      step.xp = DIFFICULTY_XP['normal'];
      step.deadline = null;
      step.completed_at = null;
      changed = true;
    }
  }

  // Ensure daily_logs array exists
  if (!db.daily_logs) {
    db.daily_logs = [];
    changed = true;
  }

  if (changed) {
    writeDatabase(db);
  }

  return db;
}

// Write JSON database
function writeDatabase(data) {
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
}

// Get default database structure
function getDefaultDatabase() {
  const defaultDate = new Date();
  defaultDate.setFullYear(defaultDate.getFullYear() + 1);

  return {
    settings: {
      resignation_date: defaultDate.toISOString().split('T')[0],
      runway_months: 12,
      start_date: null,
      player_name: '모험가',
      level: 1,
      total_xp: 0,
      current_streak: 0,
      longest_streak: 0,
      last_active_date: null
    },
    learning_steps: [
      {
        id: 1,
        category: '블로그/콘텐츠',
        title: '블로그 글쓰기',
        description: '기술 블로그 운영 및 콘텐츠 제작 능력 향상',
        completed: 0,
        progress: 0,
        order: 1,
        difficulty: 'normal',
        xp: 100,
        deadline: null,
        completed_at: null
      },
      {
        id: 2,
        category: 'YouTube',
        title: 'YouTube 콘텐츠 제작',
        description: '영상 기획, 촬영, 편집 능력 습득',
        completed: 0,
        progress: 0,
        order: 2,
        difficulty: 'normal',
        xp: 100,
        deadline: null,
        completed_at: null
      },
      {
        id: 3,
        category: '블록체인/Web3',
        title: '블록체인 개발',
        description: 'Web3 및 스마트 컨트랙트 개발 역량 강화',
        completed: 0,
        progress: 0,
        order: 3,
        difficulty: 'hard',
        xp: 200,
        deadline: null,
        completed_at: null
      },
      {
        id: 4,
        category: 'Ethereum',
        title: 'Ethereum 생태계 활동',
        description: 'DApp 개발 및 이더리움 생태계 참여',
        completed: 0,
        progress: 0,
        order: 4,
        difficulty: 'hard',
        xp: 200,
        deadline: null,
        completed_at: null
      }
    ],
    milestones: [],
    daily_logs: []
  };
}

// Get next auto-increment ID
function getNextId(items) {
  if (items.length === 0) return 1;
  return Math.max(...items.map(item => item.id)) + 1;
}

// Initialize database
export async function initDatabase() {
  if (!fs.existsSync(jsonPath)) {
    const defaultData = getDefaultDatabase();
    writeDatabase(defaultData);
  } else {
    // Run migration on existing data
    readDatabase();
  }
}

// Settings operations
export function getSettings() {
  const db = readDatabase();
  return db.settings;
}

export function updateSettings(settings) {
  const db = readDatabase();
  db.settings = { ...db.settings, ...settings };
  writeDatabase(db);
}

// Learning steps operations
export function getLearningSteps() {
  const db = readDatabase();
  return db.learning_steps.sort((a, b) => a.order - b.order);
}

export function addLearningStep(step) {
  const db = readDatabase();
  const newId = getNextId(db.learning_steps);
  const difficulty = step.difficulty || 'normal';

  const newStep = {
    id: newId,
    category: step.category,
    title: step.title,
    description: step.description,
    completed: 0,
    progress: 0,
    order: step.order,
    difficulty: difficulty,
    xp: DIFFICULTY_XP[difficulty] || 100,
    deadline: step.deadline || null,
    completed_at: null
  };

  db.learning_steps.push(newStep);
  writeDatabase(db);
  return newId;
}

export function updateLearningStep(step) {
  const db = readDatabase();
  const index = db.learning_steps.findIndex(s => s.id === step.id);

  if (index !== -1) {
    const difficulty = step.difficulty || db.learning_steps[index].difficulty || 'normal';
    db.learning_steps[index] = {
      id: step.id,
      category: step.category,
      title: step.title,
      description: step.description,
      completed: step.completed ? 1 : 0,
      progress: step.progress,
      order: step.order,
      difficulty: difficulty,
      xp: DIFFICULTY_XP[difficulty] || 100,
      deadline: step.deadline !== undefined ? step.deadline : db.learning_steps[index].deadline,
      completed_at: step.completed_at !== undefined ? step.completed_at : db.learning_steps[index].completed_at
    };
    writeDatabase(db);
  }
}

export function deleteLearningStep(id) {
  const db = readDatabase();
  db.learning_steps = db.learning_steps.filter(s => s.id !== id);
  // Also delete associated milestones
  db.milestones = db.milestones.filter(m => m.step_id !== id);
  writeDatabase(db);
}

// Complete quest — handles XP, level, streak
export function completeQuest(id) {
  const db = readDatabase();
  const index = db.learning_steps.findIndex(s => s.id === id);

  if (index === -1) return null;

  const quest = db.learning_steps[index];
  if (quest.completed) return null; // Already completed

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
    // Same day or first activity
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
  const logIndex = db.daily_logs.findIndex(l => l.date === today);
  if (logIndex !== -1) {
    db.daily_logs[logIndex].quests_completed += 1;
    db.daily_logs[logIndex].xp_earned += xpEarned;
  } else {
    db.daily_logs.push({
      date: today,
      quests_completed: 1,
      xp_earned: xpEarned
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
    longestStreak: db.settings.longest_streak
  };
}

// Daily logs operations
export function getDailyLogs(limit = 30) {
  const db = readDatabase();
  return db.daily_logs
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

// Get today's quests (incomplete, deadline-priority)
export function getTodayQuests() {
  const db = readDatabase();
  const today = new Date().toISOString().split('T')[0];

  const incomplete = db.learning_steps.filter(s => !s.completed);

  // Sort: deadline today or past first, then by closest deadline, then highest progress
  incomplete.sort((a, b) => {
    const aDeadline = a.deadline;
    const bDeadline = b.deadline;

    // Has deadline vs no deadline
    if (aDeadline && !bDeadline) return -1;
    if (!aDeadline && bDeadline) return 1;

    // Both have deadlines — closer deadline first
    if (aDeadline && bDeadline) {
      return aDeadline.localeCompare(bDeadline);
    }

    // No deadlines — higher progress first (closer to completion)
    return b.progress - a.progress;
  });

  return incomplete.slice(0, 3);
}

// Milestones operations
export function getMilestones(stepId) {
  const db = readDatabase();
  return db.milestones
    .filter(m => m.step_id === stepId)
    .sort((a, b) => a.order - b.order);
}

export function addMilestone(milestone) {
  const db = readDatabase();
  const newId = getNextId(db.milestones);

  const newMilestone = {
    id: newId,
    step_id: milestone.step_id,
    title: milestone.title,
    completed: 0,
    order: milestone.order
  };

  db.milestones.push(newMilestone);
  writeDatabase(db);
  return newId;
}

export function updateMilestone(milestone) {
  const db = readDatabase();
  const index = db.milestones.findIndex(m => m.id === milestone.id);

  if (index !== -1) {
    db.milestones[index] = {
      ...db.milestones[index],
      title: milestone.title,
      completed: milestone.completed ? 1 : 0,
      order: milestone.order
    };
    writeDatabase(db);
  }
}

export function deleteMilestone(id) {
  const db = readDatabase();
  db.milestones = db.milestones.filter(m => m.id !== id);
  writeDatabase(db);
}
