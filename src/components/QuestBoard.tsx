import { useState, useEffect, useCallback } from 'react'
import { Quest, Milestone } from '../types'
import * as api from '../api/client'

interface QuestBoardProps {
  onQuestComplete: (questId: number) => void
  onQuestsLoaded: (quests: Quest[]) => void
  refreshTrigger: number
}

const DIFFICULTY_XP: Record<string, number> = { easy: 50, normal: 100, hard: 200, epic: 500 }
const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'badge-easy',
  normal: 'badge-normal',
  hard: 'badge-hard',
  epic: 'badge-epic',
}
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '★ Easy',
  normal: '★★ Normal',
  hard: '★★★ Hard',
  epic: '★★★★ Epic',
}
const CATEGORIES = ['블로그/콘텐츠', 'YouTube', '블록체인/Web3', 'Ethereum']

function getDaysUntilDeadline(deadline: string | null): number | null {
  if (!deadline) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dl = new Date(deadline)
  dl.setHours(0, 0, 0, 0)
  return Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function QuestBoard({ onQuestComplete, onQuestsLoaded, refreshTrigger }: QuestBoardProps) {
  const [quests, setQuests] = useState<Quest[]>([])
  const [milestones, setMilestones] = useState<Record<number, Milestone[]>>({})
  const [isAddingQuest, setIsAddingQuest] = useState(false)
  const [newQuest, setNewQuest] = useState({ category: '', title: '', description: '', difficulty: 'normal' as Quest['difficulty'], deadline: '' })
  const [editingMilestone, setEditingMilestone] = useState<{ stepId: number; title: string } | null>(null)
  const [completedAnimation, setCompletedAnimation] = useState<number | null>(null)
  const [xpPopup, setXpPopup] = useState<{ questId: number; xp: number; levelUp?: { oldLevel: number; newLevel: number } } | null>(null)

  const loadQuests = useCallback(async () => {
    const data = await api.getQuests()
    setQuests(data)
    onQuestsLoaded(data)

    const milestonesData: Record<number, Milestone[]> = {}
    for (const quest of data) {
      const qMilestones = await api.getMilestones(quest.id)
      milestonesData[quest.id] = qMilestones
    }
    setMilestones(milestonesData)
  }, [onQuestsLoaded])

  useEffect(() => {
    loadQuests()
  }, [loadQuests, refreshTrigger])

  const handleCompleteQuest = async (quest: Quest) => {
    if (quest.completed) return

    try {
      const result = await api.completeQuest(quest.id)

      // Show animation
      setCompletedAnimation(quest.id)
      setXpPopup({
        questId: quest.id,
        xp: result.xpEarned,
        levelUp: result.leveledUp ? { oldLevel: result.oldLevel, newLevel: result.newLevel } : undefined
      })

      setTimeout(() => {
        setCompletedAnimation(null)
        setXpPopup(null)
      }, 2500)

      onQuestComplete(quest.id)
      loadQuests()
    } catch {
      // fallback to simple toggle
      const updated = { ...quest, completed: true, progress: 100 }
      await api.updateQuest(updated)
      loadQuests()
    }
  }

  const uncompleteQuest = async (quest: Quest) => {
    if (!quest.completed) return
    const updated = { ...quest, completed: false, progress: quest.progress < 100 ? quest.progress : 0, completedAt: null }
    await api.updateQuest(updated)
    loadQuests()
  }

  const updateProgress = async (quest: Quest, progress: number) => {
    const updated = { ...quest, progress }
    await api.updateQuest(updated)
    loadQuests()
  }

  const addQuest = async () => {
    if (!newQuest.title.trim()) return
    const maxOrder = quests.length > 0 ? Math.max(...quests.map(s => s.order)) : 0
    await api.addQuest({
      category: newQuest.category || CATEGORIES[0],
      title: newQuest.title,
      description: newQuest.description,
      completed: false,
      progress: 0,
      order: maxOrder + 1,
      difficulty: newQuest.difficulty,
      xp: DIFFICULTY_XP[newQuest.difficulty],
      deadline: newQuest.deadline || null,
      completedAt: null,
    })
    setNewQuest({ category: '', title: '', description: '', difficulty: 'normal', deadline: '' })
    setIsAddingQuest(false)
    loadQuests()
  }

  const deleteQuest = async (questId: number) => {
    if (confirm('이 퀘스트를 삭제하시겠습니까?')) {
      await api.deleteQuest(questId)
      loadQuests()
    }
  }

  const addMilestone = async (stepId: number) => {
    if (!editingMilestone || editingMilestone.stepId !== stepId) return
    const stepMilestones = milestones[stepId] || []
    const maxOrder = stepMilestones.length > 0 ? Math.max(...stepMilestones.map(m => m.order)) : 0
    await api.addMilestone({
      stepId,
      title: editingMilestone.title,
      completed: false,
      order: maxOrder + 1
    })
    setEditingMilestone(null)
    loadQuests()
  }

  const toggleMilestone = async (milestone: Milestone) => {
    await api.updateMilestone({ ...milestone, completed: !milestone.completed })
    loadQuests()
  }

  const handleDeleteMilestone = async (milestoneId: number) => {
    await api.deleteMilestone(milestoneId)
    loadQuests()
  }

  const getCategoryIcon = (category: string) => {
    if (category.includes('블로그') || category.includes('콘텐츠')) return '✍️'
    if (category.includes('YouTube')) return '🎥'
    if (category.includes('블록체인') || category.includes('Web3')) return '⛓️'
    if (category.includes('Ethereum')) return '💎'
    return '📚'
  }

  const getProgressColor = (progress: number) => {
    if (progress === 100) return 'bg-green-500'
    if (progress >= 75) return 'bg-amber-500'
    if (progress >= 50) return 'bg-yellow-500'
    if (progress >= 25) return 'bg-orange-500'
    return 'bg-gray-600'
  }

  const completedCount = quests.filter(q => q.completed).length
  const totalCount = quests.length

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">📜 퀘스트 보드</h2>
          <p className="text-gray-400 text-sm">
            클리어: {completedCount}/{totalCount} 퀘스트
          </p>
        </div>
        <button
          onClick={() => setIsAddingQuest(!isAddingQuest)}
          className="btn-primary"
        >
          {isAddingQuest ? '취소' : '+ 퀘스트 추가'}
        </button>
      </div>

      {isAddingQuest && (
        <div className="mb-6 p-4 bg-gray-700 rounded-lg space-y-3 border border-amber-700/30">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={newQuest.category}
              onChange={(e) => setNewQuest({ ...newQuest, category: e.target.value })}
              className="input-field"
            >
              <option value="">카테고리 선택</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={newQuest.difficulty}
              onChange={(e) => setNewQuest({ ...newQuest, difficulty: e.target.value as Quest['difficulty'] })}
              className="input-field"
            >
              <option value="easy">Easy (50 XP)</option>
              <option value="normal">Normal (100 XP)</option>
              <option value="hard">Hard (200 XP)</option>
              <option value="epic">Epic (500 XP)</option>
            </select>
          </div>
          <input
            type="text"
            placeholder="퀘스트 제목"
            value={newQuest.title}
            onChange={(e) => setNewQuest({ ...newQuest, title: e.target.value })}
            className="input-field w-full"
          />
          <textarea
            placeholder="퀘스트 설명"
            value={newQuest.description}
            onChange={(e) => setNewQuest({ ...newQuest, description: e.target.value })}
            className="input-field w-full h-20 resize-none"
          />
          <div>
            <label className="block text-sm text-gray-400 mb-1">마감일 (선택)</label>
            <input
              type="date"
              value={newQuest.deadline}
              onChange={(e) => setNewQuest({ ...newQuest, deadline: e.target.value })}
              className="input-field w-full"
            />
          </div>
          <button onClick={addQuest} className="btn-primary w-full">
            퀘스트 등록
          </button>
        </div>
      )}

      {/* Level-up popup */}
      {xpPopup?.levelUp && (
        <div className="level-up mb-4">
          <div className="text-center py-4 px-6 bg-amber-900/40 border border-amber-500 rounded-lg">
            <div className="text-3xl mb-2">🎉</div>
            <div className="text-xl font-bold text-amber-400">Level Up!</div>
            <div className="text-sm text-gray-300 mt-1">
              Lv.{xpPopup.levelUp.oldLevel} → Lv.{xpPopup.levelUp.newLevel}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {quests.map((quest) => {
          const daysLeft = getDaysUntilDeadline(quest.deadline)
          const isAnimating = completedAnimation === quest.id
          const xpInfo = xpPopup?.questId === quest.id ? xpPopup : null

          return (
            <div
              key={quest.id}
              className={`quest-card rounded-lg overflow-hidden border transition-all ${
                quest.completed
                  ? 'bg-gray-700/50 border-gray-600 opacity-70'
                  : isAnimating
                    ? 'bg-gray-700 border-amber-400 quest-complete-glow'
                    : 'bg-gray-700 border-gray-600 hover:border-amber-500/50'
              }`}
            >
              <div className="p-4 relative">
                {/* XP Popup */}
                {xpInfo && (
                  <div className="xp-popup absolute top-2 right-12 text-amber-400 font-bold text-lg">
                    +{xpInfo.xp} XP!
                  </div>
                )}

                {/* CLEAR stamp */}
                {quest.completed && (
                  <div className="absolute top-3 right-12 transform rotate-[-12deg]">
                    <span className="text-xl font-black text-green-500/60 border-2 border-green-500/40 px-2 py-0.5 rounded">
                      CLEAR
                    </span>
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <button
                    onClick={() => quest.completed ? uncompleteQuest(quest) : handleCompleteQuest(quest)}
                    className={`flex-shrink-0 w-7 h-7 rounded border-2 flex items-center justify-center transition-all ${
                      quest.completed
                        ? 'bg-green-600 border-green-500'
                        : 'border-amber-500/50 hover:border-amber-400 hover:bg-amber-500/10'
                    }`}
                    title={quest.completed ? '퀘스트 되돌리기' : '퀘스트 클리어!'}
                  >
                    {quest.completed ? (
                      <span className="text-sm">🛡️</span>
                    ) : (
                      <span className="text-xs text-amber-400">⚔️</span>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-2xl">{getCategoryIcon(quest.category)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`text-lg font-semibold ${quest.completed ? 'line-through text-gray-500' : ''}`}>
                            {quest.title}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[quest.difficulty]}`}>
                            {DIFFICULTY_LABELS[quest.difficulty]}
                          </span>
                          <span className="text-xs text-amber-400 font-medium">+{quest.xp}XP</span>
                          {daysLeft !== null && (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              daysLeft <= 0 ? 'bg-red-900/50 text-red-400' :
                              daysLeft <= 3 ? 'bg-orange-900/50 text-orange-400' :
                              'bg-gray-600 text-gray-300'
                            }`}>
                              {daysLeft <= 0 ? '마감!' : `D-${daysLeft}`}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">{quest.description}</p>
                      </div>
                    </div>

                    {!quest.completed && (
                      <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400">진행률</span>
                          <span className="font-semibold">{quest.progress}%</span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${getProgressColor(quest.progress)}`}
                            style={{ width: `${quest.progress}%` }}
                          />
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={quest.progress}
                          onChange={(e) => updateProgress(quest, parseInt(e.target.value))}
                          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                        />
                      </div>
                    )}

                    {/* Milestones */}
                    {milestones[quest.id] && milestones[quest.id].length > 0 && (
                      <div className="mt-4 space-y-2">
                        <div className="text-sm font-medium text-gray-400">마일스톤</div>
                        {milestones[quest.id].map((milestone) => (
                          <div key={milestone.id} className="flex items-center gap-2 text-sm">
                            <button
                              onClick={() => toggleMilestone(milestone)}
                              className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                                milestone.completed ? 'bg-amber-500 border-amber-500' : 'border-gray-500'
                              }`}
                            >
                              {milestone.completed && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <span className={milestone.completed ? 'line-through text-gray-500' : ''}>
                              {milestone.title}
                            </span>
                            <button
                              onClick={() => handleDeleteMilestone(milestone.id)}
                              className="ml-auto text-red-400 hover:text-red-300"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add milestone */}
                    <div className="mt-4">
                      {editingMilestone?.stepId === quest.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="새 마일스톤"
                            value={editingMilestone.title}
                            onChange={(e) => setEditingMilestone({ ...editingMilestone, title: e.target.value })}
                            className="input-field flex-1 text-sm py-1"
                            onKeyDown={(e) => e.key === 'Enter' && addMilestone(quest.id)}
                          />
                          <button onClick={() => addMilestone(quest.id)} className="btn-primary text-sm py-1">
                            추가
                          </button>
                          <button onClick={() => setEditingMilestone(null)} className="btn-secondary text-sm py-1">
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingMilestone({ stepId: quest.id, title: '' })}
                          className="text-sm text-amber-400 hover:text-amber-300"
                        >
                          + 마일스톤 추가
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteQuest(quest.id)}
                    className="flex-shrink-0 text-red-400 hover:text-red-300 text-xl"
                  >
                    x
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {quests.length === 0 && !isAddingQuest && (
          <div className="text-center py-12 text-gray-500">
            퀘스트를 추가하여 모험을 시작하세요!
          </div>
        )}
      </div>
    </div>
  )
}

export default QuestBoard
