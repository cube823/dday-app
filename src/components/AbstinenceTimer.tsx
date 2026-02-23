import { useState, useEffect, useCallback } from 'react'
import { DopamineCategory, AbstinenceTimer as AbstinenceTimerType } from '../types'
import * as api from '../api/client'

interface AbstinenceTimerProps {
  date: string
  abstinenceStreak: number
  categories: DopamineCategory[]
  onTimerChange: () => void
}

function formatElapsed(startedAt: string): string {
  const elapsed = Date.now() - new Date(startedAt).getTime()
  const hours = Math.floor(elapsed / (1000 * 60 * 60))
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((elapsed % (1000 * 60)) / 1000)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function AbstinenceTimerComponent({ date, abstinenceStreak, categories, onTimerChange }: AbstinenceTimerProps) {
  const [timers, setTimers] = useState<AbstinenceTimerType[]>([])
  const [, setTick] = useState(0)

  const loadTimers = useCallback(async () => {
    try {
      const data = await api.getAbstinenceTimersForDate(date)
      setTimers(data)
    } catch (error) {
      console.error('Failed to load abstinence timers:', error)
    }
  }, [date])

  useEffect(() => {
    loadTimers()
  }, [loadTimers])

  // Tick every second for active timers
  useEffect(() => {
    const hasActive = timers.some(t => !t.brokenAt && !t.isSuccess)
    if (!hasActive) return
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [timers])

  const handleStartTimer = async (categoryId: number) => {
    try {
      await api.startAbstinenceTimer(categoryId)
      await loadTimers()
      onTimerChange()
    } catch (error) {
      console.error('Failed to start timer:', error)
    }
  }

  // Find timer for each category
  const getTimerForCategory = (categoryId: number) => {
    return timers.find(t => t.categoryId === categoryId)
  }

  const getTimerStatus = (timer: AbstinenceTimerType | undefined) => {
    if (!timer) return 'idle'
    if (timer.isSuccess) return 'success'
    if (timer.brokenAt) return 'broken'
    return 'active'
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return 'border-amber-500/50 bg-amber-900/10'
      case 'success': return 'border-green-500/50 bg-green-900/10'
      case 'broken': return 'border-red-500/50 bg-red-900/10'
      default: return 'border-gray-700/50 bg-gray-800/50'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return { text: '진행중', color: 'text-amber-400' }
      case 'success': return { text: '성공! 🎉', color: 'text-green-400' }
      case 'broken': return { text: '실패', color: 'text-red-400' }
      default: return { text: '대기', color: 'text-gray-500' }
    }
  }

  return (
    <div className="card border-purple-700/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-200">⏱️ 금욕 타이머</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">연속 금욕</span>
          <span className={`text-lg font-bold ${abstinenceStreak >= 7 ? 'text-red-400' : 'text-orange-400'}`}>
            🔥 {abstinenceStreak}일
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {categories.map(cat => {
          const timer = getTimerForCategory(cat.id)
          const status = getTimerStatus(timer)
          const statusInfo = getStatusText(status)

          return (
            <div
              key={cat.id}
              className={`rounded-lg border p-3 text-center transition-all ${getStatusStyle(status)}`}
            >
              <div className="text-2xl mb-1">{cat.icon}</div>
              <div className="text-sm font-medium text-gray-300 mb-1">{cat.name}</div>

              {status === 'active' && timer && (
                <div className="text-lg font-mono text-amber-400 mb-1 animate-pulse">
                  {formatElapsed(timer.startedAt)}
                </div>
              )}

              <div className={`text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.text}
              </div>

              {status === 'idle' && (
                <button
                  onClick={() => handleStartTimer(cat.id)}
                  className="mt-2 px-3 py-1 text-xs bg-purple-600 hover:bg-purple-500 text-white rounded-md transition-colors"
                >
                  금욕 시작
                </button>
              )}
            </div>
          )
        })}
      </div>

      {categories.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-4">활성화된 카테고리가 없습니다.</p>
      )}
    </div>
  )
}

export default AbstinenceTimerComponent
