import express from 'express';
import {
  getSettings,
  updateSettings,
  getLearningSteps,
  addLearningStep,
  updateLearningStep,
  deleteLearningStep,
  completeQuest,
  getDailyLogs,
  getTodayQuests,
  getMilestones,
  addMilestone,
  updateMilestone,
  deleteMilestone
} from '../database.js';

const router = express.Router();

// Settings routes
router.get('/settings', (req, res) => {
  try {
    const settings = getSettings();
    res.json({
      resignationDate: settings.resignation_date,
      runwayMonths: settings.runway_months,
      startDate: settings.start_date,
      playerName: settings.player_name,
      level: settings.level,
      totalXp: settings.total_xp,
      currentStreak: settings.current_streak,
      longestStreak: settings.longest_streak,
      lastActiveDate: settings.last_active_date
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/settings', (req, res) => {
  try {
    const { resignationDate, runwayMonths, startDate, playerName } = req.body;
    const update = {
      resignation_date: resignationDate,
      runway_months: runwayMonths,
      start_date: startDate
    };
    if (playerName !== undefined) {
      update.player_name = playerName;
    }
    updateSettings(update);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Learning steps / quests routes
router.get('/learning-steps', (req, res) => {
  try {
    const steps = getLearningSteps();
    res.json(steps.map(step => ({
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
      completedAt: step.completed_at || null
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/learning-steps', (req, res) => {
  try {
    const { category, title, description, order, difficulty, deadline } = req.body;
    const id = addLearningStep({ category, title, description, order, difficulty, deadline });
    res.json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/learning-steps/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { category, title, description, completed, progress, order, difficulty, deadline, completedAt } = req.body;
    updateLearningStep({
      id, category, title, description, completed, progress, order,
      difficulty, deadline, completed_at: completedAt
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/learning-steps/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    deleteLearningStep(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete quest (XP + streak + level)
router.post('/complete-quest/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = completeQuest(id);
    if (!result) {
      return res.status(400).json({ error: 'Quest not found or already completed' });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Daily logs
router.get('/daily-logs', (req, res) => {
  try {
    const logs = getDailyLogs();
    res.json(logs.map(log => ({
      date: log.date,
      questsCompleted: log.quests_completed,
      xpEarned: log.xp_earned
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Today's quests
router.get('/today', (req, res) => {
  try {
    const quests = getTodayQuests();
    res.json(quests.map(q => ({
      id: q.id,
      category: q.category,
      title: q.title,
      description: q.description,
      completed: Boolean(q.completed),
      progress: q.progress,
      order: q.order,
      difficulty: q.difficulty || 'normal',
      xp: q.xp || 100,
      deadline: q.deadline || null,
      completedAt: q.completed_at || null
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Milestones routes
router.get('/milestones/:stepId', (req, res) => {
  try {
    const stepId = parseInt(req.params.stepId);
    const milestones = getMilestones(stepId);
    res.json(milestones.map(m => ({
      id: m.id,
      stepId: m.step_id,
      title: m.title,
      completed: Boolean(m.completed),
      order: m.order
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/milestones', (req, res) => {
  try {
    const { stepId, title, order } = req.body;
    const id = addMilestone({ step_id: stepId, title, order });
    res.json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/milestones/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, completed, order } = req.body;
    updateMilestone({ id, title, completed, order });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/milestones/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    deleteMilestone(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
