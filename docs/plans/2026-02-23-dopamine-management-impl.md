# Dopamine Management System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dopamine tolerance tracking system with timers, RPG stat integration, and daily reports to the D-Day resignation tracker app.

**Architecture:** Extend the existing Electron IPC pattern (database.ts -> ipc-handlers.ts -> preload.ts -> client.ts -> components). Add new DB tables for dopamine categories/logs/timers/daily snapshots. Add settings columns for tolerance and stats. Create a new "Dopamine Lab" tab with gauge, timer, and report components.

**Tech Stack:** Electron + React 18 + TypeScript + better-sqlite3 + Tailwind CSS (existing stack)

---

## Task 1: DB Schema — Add Dopamine Tables & Settings Columns

**Files:**
- Modify: `electron/database.ts` (SCHEMA constant, lines 235-290)

**Step 1: Add dopamine tables and settings columns to SCHEMA**

Append to the existing SCHEMA string (before the closing backtick):

```sql
CREATE TABLE IF NOT EXISTS dopamine_categories (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  icon            TEXT NOT NULL,
  tolerance_rate  REAL NOT NULL DEFAULT 0.2,
  is_preset       INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dopamine_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id     INTEGER NOT NULL REFERENCES dopamine_categories(id),
  started_at      TEXT NOT NULL,
  ended_at        TEXT,
  duration_min    REAL,
  tolerance_gain  REAL,
  date            TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS abstinence_timers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id     INTEGER NOT NULL REFERENCES dopamine_categories(id),
  date            TEXT NOT NULL,
  started_at      TEXT NOT NULL,
  broken_at       TEXT,
  is_success      INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dopamine_daily (
  date                TEXT PRIMARY KEY,
  tolerance_start     REAL NOT NULL,
  tolerance_end       REAL NOT NULL,
  total_usage_min     REAL NOT NULL DEFAULT 0,
  abstinence_success  INTEGER NOT NULL DEFAULT 0,
  abstinence_total    INTEGER NOT NULL DEFAULT 0,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Step 2: Add new columns to settings table in SCHEMA**

Add these columns to the existing `CREATE TABLE IF NOT EXISTS settings` block:

```sql
dopamine_tolerance REAL NOT NULL DEFAULT 50,
stat_willpower INTEGER NOT NULL DEFAULT 0,
stat_focus INTEGER NOT NULL DEFAULT 0,
abstinence_streak INTEGER NOT NULL DEFAULT 0,
```

**Step 3: Add preset seed function**

Add after `initDatabase()`:

```typescript
function seedDopamineCategories(): void {
  const database = getDb();
  const count = database.prepare('SELECT COUNT(*) as cnt FROM dopamine_categories').get() as { cnt: number };
  if (count.cnt > 0) return;

  const presets = [
    { name: 'SNS', icon: '📱', tolerance_rate: 0.15, sort_order: 0 },
    { name: '영상', icon: '📺', tolerance_rate: 0.2, sort_order: 1 },
    { name: '게임', icon: '🎮', tolerance_rate: 0.25, sort_order: 2 },
    { name: '쇼츠/릴스', icon: '📳', tolerance_rate: 0.3, sort_order: 3 },
    { name: '쇼핑', icon: '🛒', tolerance_rate: 0.15, sort_order: 4 },
    { name: '음주/야식', icon: '🍺', tolerance_rate: 0.2, sort_order: 5 },
  ];

  const insert = database.prepare(
    `INSERT INTO dopamine_categories (name, icon, tolerance_rate, is_preset, is_active, sort_order)
     VALUES (?, ?, ?, 1, 1, ?)`
  );

  for (const p of presets) {
    insert.run(p.name, p.icon, p.tolerance_rate, p.sort_order);
  }
}
```

Call `seedDopamineCategories()` at end of `initDatabase()`.

**Step 4: Update SettingsRow and CamelSettings interfaces**

Add to `SettingsRow`:
```typescript
dopamine_tolerance: number;
stat_willpower: number;
stat_focus: number;
abstinence_streak: number;
```

Add to `CamelSettings`:
```typescript
dopamineTolerance: number;
statWillpower: number;
statFocus: number;
abstinenceStreak: number;
```

Update `settingsToCamel` and `settingsToSnake` to include new fields.

**Step 5: Commit**

```
feat: add dopamine system DB schema and preset categories
```

---

## Task 2: DB CRUD — Dopamine Types & Category Functions

**Files:**
- Modify: `electron/database.ts`

**Step 1: Add dopamine row/camel interfaces**

```typescript
interface DopamineCategoryRow {
  id: number;
  name: string;
  icon: string;
  tolerance_rate: number;
  is_preset: number;
  is_active: number;
  sort_order: number;
  updated_at: string;
}

interface CamelDopamineCategory {
  id: number;
  name: string;
  icon: string;
  toleranceRate: number;
  isPreset: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface DopamineLogRow {
  id: number;
  category_id: number;
  started_at: string;
  ended_at: string | null;
  duration_min: number | null;
  tolerance_gain: number | null;
  date: string;
  updated_at: string;
}

interface CamelDopamineLog {
  id: number;
  categoryId: number;
  startedAt: string;
  endedAt: string | null;
  durationMin: number | null;
  toleranceGain: number | null;
  date: string;
}

interface AbstinenceTimerRow {
  id: number;
  category_id: number;
  date: string;
  started_at: string;
  broken_at: string | null;
  is_success: number;
  updated_at: string;
}

interface CamelAbstinenceTimer {
  id: number;
  categoryId: number;
  date: string;
  startedAt: string;
  brokenAt: string | null;
  isSuccess: boolean;
}

interface DopamineDailyRow {
  date: string;
  tolerance_start: number;
  tolerance_end: number;
  total_usage_min: number;
  abstinence_success: number;
  abstinence_total: number;
  updated_at: string;
}

interface CamelDopamineDaily {
  date: string;
  toleranceStart: number;
  toleranceEnd: number;
  totalUsageMin: number;
  abstinenceSuccess: number;
  abstinenceTotal: number;
}
```

**Step 2: Add converter functions**

```typescript
function dopamineCategoryToCamel(row: DopamineCategoryRow): CamelDopamineCategory {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    toleranceRate: row.tolerance_rate,
    isPreset: Boolean(row.is_preset),
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order,
  };
}

function dopamineLogToCamel(row: DopamineLogRow): CamelDopamineLog {
  return {
    id: row.id,
    categoryId: row.category_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMin: row.duration_min,
    toleranceGain: row.tolerance_gain,
    date: row.date,
  };
}

function abstinenceTimerToCamel(row: AbstinenceTimerRow): CamelAbstinenceTimer {
  return {
    id: row.id,
    categoryId: row.category_id,
    date: row.date,
    startedAt: row.started_at,
    brokenAt: row.broken_at,
    isSuccess: Boolean(row.is_success),
  };
}

function dopamineDailyToCamel(row: DopamineDailyRow): CamelDopamineDaily {
  return {
    date: row.date,
    toleranceStart: row.tolerance_start,
    toleranceEnd: row.tolerance_end,
    totalUsageMin: row.total_usage_min,
    abstinenceSuccess: row.abstinence_success,
    abstinenceTotal: row.abstinence_total,
  };
}
```

**Step 3: Add category CRUD**

```typescript
export function getDopamineCategories(): CamelDopamineCategory[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM dopamine_categories WHERE is_active = 1 ORDER BY sort_order ASC')
    .all() as DopamineCategoryRow[];
  return rows.map(dopamineCategoryToCamel);
}

export function addDopamineCategory(cat: { name: string; icon: string; toleranceRate: number }): number {
  const database = getDb();
  const maxOrder = database
    .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM dopamine_categories')
    .get() as { next_order: number };
  const result = database
    .prepare(
      `INSERT INTO dopamine_categories (name, icon, tolerance_rate, is_preset, is_active, sort_order)
       VALUES (?, ?, ?, 0, 1, ?)`
    )
    .run(cat.name, cat.icon, cat.toleranceRate, maxOrder.next_order);
  return Number(result.lastInsertRowid);
}

export function updateDopamineCategory(cat: { id: number; name?: string; icon?: string; toleranceRate?: number; isActive?: boolean }): void {
  const database = getDb();
  database
    .prepare(
      `UPDATE dopamine_categories SET
         name = COALESCE(?, name),
         icon = COALESCE(?, icon),
         tolerance_rate = COALESCE(?, tolerance_rate),
         is_active = COALESCE(?, is_active),
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(
      cat.name ?? null,
      cat.icon ?? null,
      cat.toleranceRate ?? null,
      cat.isActive !== undefined ? (cat.isActive ? 1 : 0) : null,
      cat.id,
    );
}

export function deleteDopamineCategory(id: number): void {
  const database = getDb();
  database.prepare('DELETE FROM dopamine_categories WHERE id = ? AND is_preset = 0').run(id);
}
```

**Step 4: Commit**

```
feat: add dopamine types and category CRUD functions
```

---

## Task 3: DB CRUD — Dopamine Logs, Abstinence Timers, Stats

**Files:**
- Modify: `electron/database.ts`

**Step 1: Add tolerance stat calculation helper**

```typescript
const TOLERANCE_STATES = [
  { max: 20, name: '각성 상태', willpower: 3, focus: 3, xpMultiplier: 1.0 },
  { max: 40, name: '맑은 정신', willpower: 2, focus: 2, xpMultiplier: 1.0 },
  { max: 60, name: '보통', willpower: 0, focus: 0, xpMultiplier: 1.0 },
  { max: 80, name: '흐릿한 정신', willpower: -1, focus: -1, xpMultiplier: 1.0 },
  { max: 100, name: '도파민 과부하', willpower: -2, focus: -2, xpMultiplier: 0.8 },
];

const QUEST_TOLERANCE_REDUCTION: Record<string, number> = {
  easy: -2,
  normal: -3,
  hard: -4,
  epic: -5,
};

function getToleranceState(tolerance: number) {
  const clamped = Math.max(0, Math.min(100, tolerance));
  return TOLERANCE_STATES.find(s => clamped <= s.max) || TOLERANCE_STATES[TOLERANCE_STATES.length - 1];
}

function recalcStats(database: Database.Database, tolerance: number): void {
  const state = getToleranceState(tolerance);
  database
    .prepare(
      `UPDATE settings SET
         dopamine_tolerance = ?,
         stat_willpower = ?,
         stat_focus = ?,
         updated_at = datetime('now')
       WHERE id = 1`
    )
    .run(
      Math.max(0, Math.min(100, tolerance)),
      state.willpower,
      state.focus,
    );
}
```

**Step 2: Add dopamine log functions**

```typescript
export function startDopamineLog(categoryId: number): number {
  const database = getDb();
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const result = database
    .prepare(
      `INSERT INTO dopamine_logs (category_id, started_at, date)
       VALUES (?, ?, ?)`
    )
    .run(categoryId, now, today);

  // Break any active abstinence timer for this category today
  database
    .prepare(
      `UPDATE abstinence_timers SET broken_at = ?, updated_at = datetime('now')
       WHERE category_id = ? AND date = ? AND broken_at IS NULL AND is_success = 0`
    )
    .run(now, categoryId, today);

  return Number(result.lastInsertRowid);
}

export function stopDopamineLog(logId: number): CamelDopamineLog | null {
  const database = getDb();

  const row = database
    .prepare('SELECT * FROM dopamine_logs WHERE id = ?')
    .get(logId) as DopamineLogRow | undefined;

  if (!row || row.ended_at) return null;

  const now = new Date().toISOString();
  const startTime = new Date(row.started_at).getTime();
  const endTime = new Date(now).getTime();
  const durationMin = (endTime - startTime) / (1000 * 60);

  // Get category tolerance rate
  const cat = database
    .prepare('SELECT tolerance_rate FROM dopamine_categories WHERE id = ?')
    .get(row.category_id) as { tolerance_rate: number } | undefined;

  const rate = cat?.tolerance_rate ?? 0.2;
  const toleranceGain = Math.round(durationMin * rate * 100) / 100;

  // Update log
  database
    .prepare(
      `UPDATE dopamine_logs SET ended_at = ?, duration_min = ?, tolerance_gain = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(now, Math.round(durationMin * 100) / 100, toleranceGain, logId);

  // Update tolerance in settings
  const settings = database.prepare('SELECT dopamine_tolerance FROM settings WHERE id = 1').get() as { dopamine_tolerance: number };
  const newTolerance = Math.min(100, (settings.dopamine_tolerance ?? 50) + toleranceGain);
  recalcStats(database, newTolerance);

  markDirty('dopamine_logs', logId);
  markDirty('settings', 1);

  return dopamineLogToCamel(
    database.prepare('SELECT * FROM dopamine_logs WHERE id = ?').get(logId) as DopamineLogRow
  );
}

export function getActiveDopamineLog(): CamelDopamineLog | null {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM dopamine_logs WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1')
    .get() as DopamineLogRow | undefined;
  return row ? dopamineLogToCamel(row) : null;
}

export function getDopamineLogsForDate(date: string): CamelDopamineLog[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM dopamine_logs WHERE date = ? ORDER BY started_at DESC')
    .all(date) as DopamineLogRow[];
  return rows.map(dopamineLogToCamel);
}
```

**Step 3: Add abstinence timer functions**

```typescript
export function startAbstinenceTimer(categoryId: number): number {
  const database = getDb();
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // Check if timer already exists for today + category
  const existing = database
    .prepare('SELECT id FROM abstinence_timers WHERE category_id = ? AND date = ?')
    .get(categoryId, today) as { id: number } | undefined;

  if (existing) return existing.id;

  const result = database
    .prepare(
      `INSERT INTO abstinence_timers (category_id, date, started_at)
       VALUES (?, ?, ?)`
    )
    .run(categoryId, today, now);

  return Number(result.lastInsertRowid);
}

export function getAbstinenceTimersForDate(date: string): (CamelAbstinenceTimer & { categoryName: string; categoryIcon: string })[] {
  const database = getDb();
  const rows = database
    .prepare(
      `SELECT at.*, dc.name as category_name, dc.icon as category_icon
       FROM abstinence_timers at
       JOIN dopamine_categories dc ON at.category_id = dc.id
       WHERE at.date = ?
       ORDER BY dc.sort_order ASC`
    )
    .all(date) as (AbstinenceTimerRow & { category_name: string; category_icon: string })[];

  return rows.map(row => ({
    ...abstinenceTimerToCamel(row),
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
  }));
}

export function finalizeDay(date: string): void {
  const database = getDb();

  const doFinalize = database.transaction(() => {
    const settings = database.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow & {
      dopamine_tolerance: number;
      abstinence_streak: number;
    };

    const toleranceStart = settings.dopamine_tolerance ?? 50;

    // Finalize abstinence timers: mark unbroken ones as success
    database
      .prepare(
        `UPDATE abstinence_timers SET is_success = 1, updated_at = datetime('now')
         WHERE date = ? AND broken_at IS NULL AND is_success = 0`
      )
      .run(date);

    // Count successes
    const timerStats = database
      .prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN is_success = 1 THEN 1 ELSE 0 END) as successes
         FROM abstinence_timers WHERE date = ?`
      )
      .get(date) as { total: number; successes: number };

    // Calculate tolerance changes
    let toleranceChange = 0;

    // Natural recovery: -3 if no dopamine logs today
    const logCount = database
      .prepare('SELECT COUNT(*) as cnt FROM dopamine_logs WHERE date = ?')
      .get(date) as { cnt: number };

    if (logCount.cnt === 0) {
      toleranceChange -= 3;
    }

    // Abstinence bonus: -2 per successful timer
    toleranceChange -= (timerStats.successes ?? 0) * 2;

    // Total usage minutes
    const usageStats = database
      .prepare('SELECT COALESCE(SUM(duration_min), 0) as total_min FROM dopamine_logs WHERE date = ? AND ended_at IS NOT NULL')
      .get(date) as { total_min: number };

    const newTolerance = Math.max(0, Math.min(100, toleranceStart + toleranceChange));

    // Update abstinence streak
    let newStreak = settings.abstinence_streak ?? 0;
    if (timerStats.total > 0 && timerStats.successes === timerStats.total) {
      newStreak += 1;
    } else if (timerStats.total > 0) {
      newStreak = 0;
    }

    // Save daily snapshot
    database
      .prepare(
        `INSERT INTO dopamine_daily (date, tolerance_start, tolerance_end, total_usage_min, abstinence_success, abstinence_total)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(date) DO UPDATE SET
           tolerance_end = ?, total_usage_min = ?, abstinence_success = ?, abstinence_total = ?,
           updated_at = datetime('now')`
      )
      .run(
        date, toleranceStart, newTolerance, usageStats.total_min, timerStats.successes ?? 0, timerStats.total ?? 0,
        newTolerance, usageStats.total_min, timerStats.successes ?? 0, timerStats.total ?? 0,
      );

    // Update settings
    database
      .prepare(
        `UPDATE settings SET abstinence_streak = ?, updated_at = datetime('now') WHERE id = 1`
      )
      .run(newStreak);

    recalcStats(database, newTolerance);
  });

  doFinalize();
}

export function getDopamineDaily(date: string): CamelDopamineDaily | null {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM dopamine_daily WHERE date = ?')
    .get(date) as DopamineDailyRow | undefined;
  return row ? dopamineDailyToCamel(row) : null;
}

export function getDopamineDailyRange(days: number): CamelDopamineDaily[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM dopamine_daily ORDER BY date DESC LIMIT ?')
    .all(days) as DopamineDailyRow[];
  return rows.map(dopamineDailyToCamel);
}
```

**Step 4: Modify `completeQuest` to reduce tolerance**

In the existing `completeQuest` function, after XP/level calculation (around line 683), add:

```typescript
// Dopamine: reduce tolerance on quest completion
const toleranceReduction = QUEST_TOLERANCE_REDUCTION[quest.difficulty] ?? -3;
const currentTolerance = settingsRow.dopamine_tolerance ?? 50;
const newToleranceAfterQuest = Math.max(0, currentTolerance + toleranceReduction);
recalcStats(database, newToleranceAfterQuest);
```

**Step 5: Export new functions and constants**

Add to exports at bottom of file:
```typescript
export {
  DIFFICULTY_XP,
  TOLERANCE_STATES,
  getToleranceState,
  getDopamineCategories, addDopamineCategory, updateDopamineCategory, deleteDopamineCategory,
  startDopamineLog, stopDopamineLog, getActiveDopamineLog, getDopamineLogsForDate,
  startAbstinenceTimer, getAbstinenceTimersForDate, finalizeDay,
  getDopamineDaily, getDopamineDailyRange,
};
```

**Step 6: Commit**

```
feat: add dopamine log, abstinence timer, and stat calculation logic
```

---

## Task 4: IPC Handlers — Register Dopamine Channels

**Files:**
- Modify: `electron/ipc-handlers.ts`

**Step 1: Add imports from database.ts**

Add to import block:
```typescript
import {
  getDopamineCategories, addDopamineCategory, updateDopamineCategory, deleteDopamineCategory,
  startDopamineLog, stopDopamineLog, getActiveDopamineLog, getDopamineLogsForDate,
  startAbstinenceTimer, getAbstinenceTimersForDate, finalizeDay,
  getDopamineDaily, getDopamineDailyRange,
} from './database';
```

**Step 2: Add IPC handlers inside `registerIpcHandlers()`**

```typescript
// ── Dopamine Categories ──────────────────────────────────────────────────
ipcMain.handle('dopamine:getCategories', () => getDopamineCategories());
ipcMain.handle('dopamine:addCategory', (_event: IpcMainInvokeEvent, cat: Record<string, unknown>) =>
  addDopamineCategory(cat as Parameters<typeof addDopamineCategory>[0])
);
ipcMain.handle('dopamine:updateCategory', (_event: IpcMainInvokeEvent, cat: Record<string, unknown>) =>
  updateDopamineCategory(cat as Parameters<typeof updateDopamineCategory>[0])
);
ipcMain.handle('dopamine:deleteCategory', (_event: IpcMainInvokeEvent, id: number) =>
  deleteDopamineCategory(id)
);

// ── Dopamine Logs ────────────────────────────────────────────────────────
ipcMain.handle('dopamine:startLog', (_event: IpcMainInvokeEvent, categoryId: number) =>
  startDopamineLog(categoryId)
);
ipcMain.handle('dopamine:stopLog', (_event: IpcMainInvokeEvent, logId: number) =>
  stopDopamineLog(logId)
);
ipcMain.handle('dopamine:getActiveLog', () => getActiveDopamineLog());
ipcMain.handle('dopamine:getLogsForDate', (_event: IpcMainInvokeEvent, date: string) =>
  getDopamineLogsForDate(date)
);

// ── Abstinence Timers ────────────────────────────────────────────────────
ipcMain.handle('dopamine:startAbstinence', (_event: IpcMainInvokeEvent, categoryId: number) =>
  startAbstinenceTimer(categoryId)
);
ipcMain.handle('dopamine:getAbstinenceTimers', (_event: IpcMainInvokeEvent, date: string) =>
  getAbstinenceTimersForDate(date)
);
ipcMain.handle('dopamine:finalizeDay', (_event: IpcMainInvokeEvent, date: string) =>
  finalizeDay(date)
);

// ── Dopamine Daily ───────────────────────────────────────────────────────
ipcMain.handle('dopamine:getDaily', (_event: IpcMainInvokeEvent, date: string) =>
  getDopamineDaily(date)
);
ipcMain.handle('dopamine:getDailyRange', (_event: IpcMainInvokeEvent, days: number) =>
  getDopamineDailyRange(days)
);
```

**Step 3: Commit**

```
feat: register dopamine IPC handlers
```

---

## Task 5: Preload & API Client — Expose Dopamine APIs

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/types/index.ts`
- Modify: `src/api/client.ts`

**Step 1: Add to preload.ts**

Add inside `contextBridge.exposeInMainWorld('electronAPI', { ... })`:

```typescript
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
```

**Step 2: Add types to `src/types/index.ts`**

```typescript
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
```

Add to Settings interface:
```typescript
dopamineTolerance: number;
statWillpower: number;
statFocus: number;
abstinenceStreak: number;
```

**Step 3: Update `src/api/client.ts`**

Add type imports and extend `Window.electronAPI` interface with all new methods.

Add wrapper functions:
```typescript
// Dopamine Categories
export async function getDopamineCategories(): Promise<DopamineCategory[]> {
  return window.electronAPI.getDopamineCategories();
}
export async function addDopamineCategory(cat: { name: string; icon: string; toleranceRate: number }): Promise<number> {
  return window.electronAPI.addDopamineCategory(cat);
}
export async function updateDopamineCategory(cat: { id: number; name?: string; icon?: string; toleranceRate?: number; isActive?: boolean }): Promise<void> {
  return window.electronAPI.updateDopamineCategory(cat);
}
export async function deleteDopamineCategory(id: number): Promise<void> {
  return window.electronAPI.deleteDopamineCategory(id);
}

// Dopamine Logs
export async function startDopamineLog(categoryId: number): Promise<number> {
  return window.electronAPI.startDopamineLog(categoryId);
}
export async function stopDopamineLog(logId: number): Promise<DopamineLog> {
  return window.electronAPI.stopDopamineLog(logId);
}
export async function getActiveDopamineLog(): Promise<DopamineLog | null> {
  return window.electronAPI.getActiveDopamineLog();
}
export async function getDopamineLogsForDate(date: string): Promise<DopamineLog[]> {
  return window.electronAPI.getDopamineLogsForDate(date);
}

// Abstinence Timers
export async function startAbstinenceTimer(categoryId: number): Promise<number> {
  return window.electronAPI.startAbstinenceTimer(categoryId);
}
export async function getAbstinenceTimersForDate(date: string): Promise<AbstinenceTimer[]> {
  return window.electronAPI.getAbstinenceTimersForDate(date);
}
export async function finalizeDay(date: string): Promise<void> {
  return window.electronAPI.finalizeDay(date);
}

// Dopamine Daily
export async function getDopamineDaily(date: string): Promise<DopamineDaily | null> {
  return window.electronAPI.getDopamineDaily(date);
}
export async function getDopamineDailyRange(days: number): Promise<DopamineDaily[]> {
  return window.electronAPI.getDopamineDailyRange(days);
}
```

**Step 4: Commit**

```
feat: expose dopamine APIs through preload and client
```

---

## Task 6: UI — ToleranceGauge Component

**Files:**
- Create: `src/components/ToleranceGauge.tsx`

**Step 1: Create component**

Displays:
- Tolerance gauge (0-100) with color gradient (green -> red)
- Current state name and emoji
- Willpower and Focus stats
- Props: `tolerance: number, statWillpower: number, statFocus: number`

Uses existing Tailwind card styling pattern from other components.

Color logic:
- 0-20: green (bg-green-500)
- 21-40: blue (bg-blue-500)
- 41-60: yellow (bg-yellow-500)
- 61-80: orange (bg-orange-500)
- 81-100: red (bg-red-500)

**Step 2: Commit**

```
feat: add ToleranceGauge component
```

---

## Task 7: UI — AbstinenceTimer Component

**Files:**
- Create: `src/components/AbstinenceTimer.tsx`

**Step 1: Create component**

Displays:
- Grid of timer cards per active category
- Each card shows: icon, name, elapsed time (useEffect interval), status (진행중/성공/실패)
- "금욕 시작" button per category (calls startAbstinenceTimer)
- Timer runs client-side with setInterval, shows HH:MM:SS since startedAt
- Broken timers show red, successful show green, active show amber pulse
- Abstinence streak counter at bottom

Props: `date: string, abstinenceStreak: number, onTimerBreak: () => void`

Uses api.getAbstinenceTimersForDate, api.startAbstinenceTimer.

**Step 2: Commit**

```
feat: add AbstinenceTimer component
```

---

## Task 8: UI — DopamineReport Component

**Files:**
- Create: `src/components/DopamineReport.tsx`

**Step 1: Create component**

Displays today's dopamine summary:
- Total low-dopamine usage time (from dopamine_logs)
- Tolerance change (tolerance_end - tolerance_start or current - start)
- Abstinence success count / total
- Positive/negative message based on change

Props: `date: string, currentTolerance: number`

Uses api.getDopamineLogsForDate, api.getDopamineDaily.

**Step 2: Commit**

```
feat: add DopamineReport component
```

---

## Task 9: UI — DopamineLab Container

**Files:**
- Create: `src/components/DopamineLab.tsx`

**Step 1: Create container**

Combines all dopamine sub-components:
- ToleranceGauge (top)
- Active dopamine timer section (if log running: show stop button + real-time counter)
- "저급 도파민 사용 중" button: opens category selector, starts log
- AbstinenceTimer section
- DopamineReport section (bottom)

State management:
- Load categories, active log, abstinence timers, daily data on mount
- Active log timer: setInterval updating elapsed time
- Refresh after start/stop actions

Props: `settings: Settings, onSettingsRefresh: () => void`

**Step 2: Commit**

```
feat: add DopamineLab container component
```

---

## Task 10: App.tsx — Add Tab Navigation

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add tab state and navigation**

Add a tab state: `const [activeTab, setActiveTab] = useState<'quest' | 'dopamine'>('quest')`

Add tab bar below header:

```tsx
<div className="flex gap-2 mb-6">
  <button
    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
      activeTab === 'quest'
        ? 'bg-amber-600 text-white'
        : 'bg-gray-800 text-gray-400 hover:text-white'
    }`}
    onClick={() => setActiveTab('quest')}
  >
    Quest Log
  </button>
  <button
    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
      activeTab === 'dopamine'
        ? 'bg-purple-600 text-white'
        : 'bg-gray-800 text-gray-400 hover:text-white'
    }`}
    onClick={() => setActiveTab('dopamine')}
  >
    Dopamine Lab
  </button>
</div>
```

**Step 2: Conditional rendering**

HeroStatus stays visible in both tabs.

```tsx
{activeTab === 'quest' && (
  <>
    <DDay ... />
    <DailyQuest ... />
    <QuestBoard ... />
    <Runway ... />
  </>
)}

{activeTab === 'dopamine' && (
  <DopamineLab
    settings={settings}
    onSettingsRefresh={loadSettings}
  />
)}
```

**Step 3: Commit**

```
feat: add tab navigation between Quest Log and Dopamine Lab
```

---

## Task 11: HeroStatus — Add Stats Display

**Files:**
- Modify: `src/components/HeroStatus.tsx`

**Step 1: Add stat display**

After the streak section, add willpower and focus stats:

```tsx
{(settings.statWillpower !== 0 || settings.statFocus !== 0) && (
  <div className="flex items-center gap-3">
    <div className="text-center">
      <div className="text-sm font-bold text-blue-400">
        {settings.statWillpower > 0 ? '+' : ''}{settings.statWillpower}
      </div>
      <div className="text-xs text-gray-500">의지력</div>
    </div>
    <div className="text-center">
      <div className="text-sm font-bold text-cyan-400">
        {settings.statFocus > 0 ? '+' : ''}{settings.statFocus}
      </div>
      <div className="text-xs text-gray-500">집중력</div>
    </div>
  </div>
)}
```

**Step 2: Commit**

```
feat: display willpower and focus stats in HeroStatus
```

---

## Task 12: Verify & Final Commit

**Step 1: Run dev server and manually verify**

```bash
npm run dev
```

Check:
- [ ] App loads without errors
- [ ] Tab navigation works (Quest Log / Dopamine Lab)
- [ ] ToleranceGauge displays correctly (50/100 default)
- [ ] Category cards show 6 presets
- [ ] Abstinence timer can be started
- [ ] Dopamine log can be started/stopped
- [ ] Tolerance changes after stopping a log
- [ ] HeroStatus shows stats when non-zero
- [ ] DopamineReport shows today's data

**Step 2: Final commit if any fixes needed**

```
fix: polish dopamine management system
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | DB Schema + Seed | `electron/database.ts` |
| 2 | Types + Category CRUD | `electron/database.ts` |
| 3 | Logs + Timers + Stats logic | `electron/database.ts` |
| 4 | IPC Handlers | `electron/ipc-handlers.ts` |
| 5 | Preload + Types + Client | `electron/preload.ts`, `src/types/index.ts`, `src/api/client.ts` |
| 6 | ToleranceGauge | `src/components/ToleranceGauge.tsx` |
| 7 | AbstinenceTimer | `src/components/AbstinenceTimer.tsx` |
| 8 | DopamineReport | `src/components/DopamineReport.tsx` |
| 9 | DopamineLab | `src/components/DopamineLab.tsx` |
| 10 | App.tsx tabs | `src/App.tsx` |
| 11 | HeroStatus stats | `src/components/HeroStatus.tsx` |
| 12 | Verify & polish | All |
