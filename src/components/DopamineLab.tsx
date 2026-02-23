import { useState, useEffect, useCallback } from 'react'
import { Settings, DopamineCategory, DopamineLog } from '../types'
import ToleranceGauge from './ToleranceGauge'
import AbstinenceTimerComponent from './AbstinenceTimer'
import DopamineReport from './DopamineReport'
import * as api from '../api/client'

interface DopamineLabProps {
  settings: Settings
  onSettingsChange: () => void
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

function DopamineLab({ settings, onSettingsChange }: DopamineLabProps) {
  const [categories, setCategories] = useState<DopamineCategory[]>([])
  const [activeLog, setActiveLog] = useState<DopamineLog | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const today = getTodayString()

  const loadCategories = useCallback(async () => {
    try {
      const data = await api.getDopamineCategories()
      setCategories(data.filter(c => c.isActive))
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }, [])

  const checkActiveLog = useCallback(async () => {
    try {
      const log = await api.getActiveDopamineLog()
      setActiveLog(log)
      setIsTracking(!!log)
      if (log) setSelectedCategoryId(log.categoryId)
    } catch (error) {
      console.error('Failed to check active log:', error)
    }
  }, [])

  useEffect(() => {
    loadCategories()
    checkActiveLog()
  }, [loadCategories, checkActiveLog])

  const handleStartTracking = async () => {
    if (!selectedCategoryId) return
    try {
      await api.startDopamineLog(selectedCategoryId)
      await checkActiveLog()
    } catch (error) {
      console.error('Failed to start tracking:', error)
    }
  }

  const handleStopTracking = async () => {
    if (!activeLog) return
    try {
      await api.stopDopamineLog(activeLog.id)
      setActiveLog(null)
      setIsTracking(false)
      onSettingsChange()
    } catch (error) {
      console.error('Failed to stop tracking:', error)
    }
  }

  const handleFinalizeDay = async () => {
    try {
      await api.finalizeDay(today)
      onSettingsChange()
    } catch (error) {
      console.error('Failed to finalize day:', error)
    }
  }

  const activeCategoryName = activeLog
    ? categories.find(c => c.id === activeLog.categoryId)?.name ?? '알 수 없음'
    : null

  return (
    <div className="space-y-4">
      {/* Tolerance Gauge */}
      <ToleranceGauge
        tolerance={settings.dopamineTolerance}
        statWillpower={settings.statWillpower}
        statFocus={settings.statFocus}
      />

      {/* Active Tracker */}
      <div className="card border-indigo-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-200">🎮 도파민 사용 추적</h3>
          {isTracking && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              기록 중
            </span>
          )}
        </div>

        {!isTracking ? (
          <div className="flex items-center gap-3">
            <select
              value={selectedCategoryId ?? ''}
              onChange={e => setSelectedCategoryId(Number(e.target.value) || null)}
              className="input-field flex-1 text-sm"
            >
              <option value="">카테고리 선택...</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleStartTracking}
              disabled={!selectedCategoryId}
              className="btn-primary text-sm whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            >
              시작
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">
              <span className="text-indigo-400 font-medium">{activeCategoryName}</span> 사용 중...
            </div>
            <button
              onClick={handleStopTracking}
              className="px-4 py-2 text-sm bg-red-700/70 hover:bg-red-600/70 text-red-200 rounded-lg transition-colors"
            >
              중단
            </button>
          </div>
        )}
      </div>

      {/* Abstinence Timers */}
      <AbstinenceTimerComponent
        date={today}
        abstinenceStreak={settings.abstinenceStreak}
        categories={categories}
        onTimerChange={onSettingsChange}
      />

      {/* Daily Report */}
      <DopamineReport date={today} categories={categories} />

      {/* Finalize Day */}
      <div className="card border-gray-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-gray-300">하루 마감</h4>
            <p className="text-xs text-gray-500 mt-0.5">내성 변화를 확정하고 금욕 타이머 결과를 저장합니다.</p>
          </div>
          <button
            onClick={handleFinalizeDay}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
          >
            마감하기
          </button>
        </div>
      </div>
    </div>
  )
}

export default DopamineLab
