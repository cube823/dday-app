import { useState, useEffect } from 'react'
import { Settings, Quest } from '../types'

interface DDayProps {
  settings: Settings
  quests: Quest[]
  onSettingsUpdate: (settings: Settings) => void
}

function DDay({ settings, onSettingsUpdate, quests }: DDayProps) {
  const [daysRemaining, setDaysRemaining] = useState(0)
  const [isEditing, setIsEditing] = useState(false)
  const [editDate, setEditDate] = useState(settings.resignationDate)
  const [totalDays, setTotalDays] = useState(0)
  const [progressPercentage, setProgressPercentage] = useState(0)

  useEffect(() => {
    calculateDays()
    const interval = setInterval(calculateDays, 60000)
    return () => clearInterval(interval)
  }, [settings.resignationDate])

  const calculateDays = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const targetDate = new Date(settings.resignationDate)
    targetDate.setHours(0, 0, 0, 0)

    const diffTime = targetDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    setDaysRemaining(diffDays)

    const oneYearAgo = new Date(targetDate)
    oneYearAgo.setFullYear(targetDate.getFullYear() - 1)

    const totalDiff = targetDate.getTime() - oneYearAgo.getTime()
    const elapsedDiff = today.getTime() - oneYearAgo.getTime()

    const total = Math.ceil(totalDiff / (1000 * 60 * 60 * 24))
    const percentage = Math.min(100, Math.max(0, (elapsedDiff / totalDiff) * 100))

    setTotalDays(total)
    setProgressPercentage(percentage)
  }

  const handleSave = () => {
    onSettingsUpdate({ ...settings, resignationDate: editDate })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditDate(settings.resignationDate)
    setIsEditing(false)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const getStatusColor = () => {
    if (daysRemaining < 0) return 'text-red-400'
    if (daysRemaining <= 30) return 'text-orange-400'
    if (daysRemaining <= 90) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getProgressColor = () => {
    if (progressPercentage >= 75) return 'bg-green-500'
    if (progressPercentage >= 50) return 'bg-yellow-500'
    if (progressPercentage >= 25) return 'bg-orange-500'
    return 'bg-primary-500'
  }

  // Pace comparison
  const totalQuestCount = quests.length
  const actualProgress = totalQuestCount > 0
    ? quests.reduce((sum, q) => sum + q.progress, 0) / totalQuestCount
    : 0

  const expectedProgress = Math.min(100, Math.max(0, progressPercentage))
  const paceDiff = actualProgress - expectedProgress

  const getPaceStatus = () => {
    if (paceDiff > 5) return { label: '앞서가는 중!', color: 'text-green-400', bg: 'pace-ahead', sign: '+' }
    if (paceDiff >= -5) return { label: '페이스 유지 중', color: 'text-yellow-400', bg: 'pace-even', sign: '' }
    return { label: '뒤처지고 있어요!', color: 'text-red-400', bg: 'pace-behind', sign: '' }
  }

  const pace = getPaceStatus()

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">🎯 퇴사 D-Day</h2>
          <p className="text-gray-400 text-sm">목표일까지 남은 시간</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="btn-secondary text-sm"
          >
            날짜 수정
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">목표 퇴사일</label>
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} className="btn-primary">
              저장
            </button>
            <button onClick={handleCancel} className="btn-secondary">
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-center">
            <div className={`text-7xl font-bold mb-4 ${getStatusColor()}`}>
              {daysRemaining < 0 ? '+' : ''}{Math.abs(daysRemaining)}
            </div>
            <div className="text-2xl font-semibold text-gray-300 mb-2">
              {daysRemaining < 0 ? '일 경과' : '일 남음'}
            </div>
            <div className="text-lg text-gray-400">
              목표일: {formatDate(settings.resignationDate)}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>진행률</span>
              <span>{progressPercentage.toFixed(1)}%</span>
            </div>
            <div className="progress-bar h-4">
              <div
                className={`progress-fill ${getProgressColor()}`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>1년 전</span>
              <span>D-Day</span>
            </div>
          </div>

          {/* Pace comparison */}
          {totalQuestCount > 0 && (
            <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-300">퀘스트 페이스</span>
                <span className={`text-sm font-bold ${pace.color}`}>
                  {paceDiff > 5 ? '🟢' : paceDiff >= -5 ? '🟡' : '🔴'} {pace.label} ({pace.sign}{Math.abs(paceDiff).toFixed(0)}%)
                </span>
              </div>
              <div className="relative h-4 rounded-full overflow-hidden bg-gray-600">
                {/* Expected progress (translucent) */}
                <div
                  className="absolute top-0 left-0 h-full bg-gray-400/30 transition-all"
                  style={{ width: `${expectedProgress}%` }}
                />
                {/* Actual progress */}
                <div
                  className={`absolute top-0 left-0 h-full transition-all ${
                    paceDiff > 5 ? 'bg-green-500' : paceDiff >= -5 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${actualProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>기대: {expectedProgress.toFixed(0)}%</span>
                <span>실제: {actualProgress.toFixed(0)}%</span>
              </div>
            </div>
          )}

          {daysRemaining > 0 && (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-400">
                  {Math.floor(daysRemaining / 30)}
                </div>
                <div className="text-xs text-gray-400 mt-1">개월</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent-400">
                  {Math.floor(daysRemaining / 7)}
                </div>
                <div className="text-xs text-gray-400 mt-1">주</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {Math.floor((totalDays - daysRemaining) / totalDays * 100)}%
                </div>
                <div className="text-xs text-gray-400 mt-1">완료</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DDay
