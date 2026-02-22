import { useState } from 'react'
import { Settings, Quest } from '../types'

interface HeroStatusProps {
  settings: Settings
  quests: Quest[]
  onNameUpdate: (name: string) => void
}

function getTitle(level: number): string {
  if (level >= 21) return '전설의 용사'
  if (level >= 11) return '엘리트 기사'
  if (level >= 6) return '숙련 전사'
  return '견습 모험가'
}

function getXpForNextLevel(level: number): number {
  return level * 150
}

function getXpInCurrentLevel(totalXp: number, level: number): number {
  let xpUsed = 0
  for (let i = 1; i < level; i++) {
    xpUsed += i * 150
  }
  return totalXp - xpUsed
}

function HeroStatus({ settings, quests, onNameUpdate }: HeroStatusProps) {
  const { playerName, level, totalXp, currentStreak, lastActiveDate } = settings
  const title = getTitle(level)
  const xpForNext = getXpForNextLevel(level)
  const xpInLevel = getXpInCurrentLevel(totalXp, level)
  const xpPercentage = Math.min(100, (xpInLevel / xpForNext) * 100)

  const today = new Date().toISOString().split('T')[0]
  const todayCompleted = quests.filter(q => q.completed && q.completedAt === today).length
  const totalIncomplete = quests.filter(q => !q.completed).length

  const streakAtRisk = currentStreak > 0 && lastActiveDate !== today

  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(playerName)

  const handleSaveName = () => {
    if (editName.trim()) {
      onNameUpdate(editName.trim())
    }
    setIsEditingName(false)
  }

  return (
    <div className="card border-amber-700/50 bg-gradient-to-r from-gray-800 via-gray-800 to-amber-900/20">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Player Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-600/30 border-2 border-amber-500 flex items-center justify-center text-2xl">
            {level >= 21 ? '👑' : level >= 11 ? '🛡️' : level >= 6 ? '⚔️' : '🗡️'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    onBlur={handleSaveName}
                    className="input-field text-sm py-1 px-2 w-32"
                    autoFocus
                  />
                </div>
              ) : (
                <h2
                  className="text-lg font-bold text-amber-400 cursor-pointer hover:text-amber-300 truncate"
                  onClick={() => { setEditName(playerName); setIsEditingName(true) }}
                  title="클릭하여 이름 변경"
                >
                  {playerName}
                </h2>
              )}
              <span className="text-xs px-2 py-0.5 bg-amber-600/30 text-amber-400 rounded-full whitespace-nowrap">
                {title}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Lv.{level}
            </div>
          </div>
        </div>

        {/* XP Bar */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>EXP</span>
            <span>{xpInLevel} / {xpForNext} XP</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden bg-gray-700 border border-gray-600">
            <div
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
              style={{ width: `${xpPercentage}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            총 {totalXp} XP 획득
          </div>
        </div>

        {/* Streak + Today */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-2xl ${currentStreak >= 7 ? 'streak-fire-hot' : ''}`}>
              🔥
            </div>
            <div className={`text-sm font-bold ${currentStreak >= 7 ? 'text-red-400' : 'text-orange-400'}`}>
              {currentStreak}일
            </div>
            <div className="text-xs text-gray-500">연속</div>
          </div>

          <div className="text-center">
            <div className="text-sm font-semibold text-gray-300">
              {todayCompleted}<span className="text-gray-500">/{totalIncomplete + todayCompleted}</span>
            </div>
            <div className="text-xs text-gray-500">오늘 완료</div>
          </div>
        </div>
      </div>

      {/* Streak warning */}
      {streakAtRisk && currentStreak > 0 && (
        <div className="mt-3 px-3 py-2 bg-orange-900/30 border border-orange-700/50 rounded-lg text-sm text-orange-300">
          ⚠️ 오늘 퀘스트를 완료하지 않으면 {currentStreak}일 연속 기록이 끊겨요!
        </div>
      )}
    </div>
  )
}

export default HeroStatus
