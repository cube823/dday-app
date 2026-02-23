import { useState, useEffect, useCallback } from 'react'
import { DopamineDaily, DopamineCategory, DopamineLog } from '../types'
import * as api from '../api/client'

interface DopamineReportProps {
  date: string
  categories: DopamineCategory[]
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min}분`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`
}

function DopamineReport({ date, categories }: DopamineReportProps) {
  const [daily, setDaily] = useState<DopamineDaily | null>(null)
  const [logs, setLogs] = useState<DopamineLog[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dailyData, logsData] = await Promise.all([
        api.getDopamineDaily(date),
        api.getDopamineLogsForDate(date),
      ])
      setDaily(dailyData)
      setLogs(logsData)
    } catch (error) {
      console.error('Failed to load dopamine report:', error)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Usage per category
  const usageByCategory = categories.map(cat => {
    const catLogs = logs.filter(l => l.categoryId === cat.id && l.durationMin != null)
    const totalMin = catLogs.reduce((acc, l) => acc + (l.durationMin ?? 0), 0)
    return { cat, totalMin, count: catLogs.length }
  }).filter(item => item.totalMin > 0)

  const toleranceDelta = daily
    ? daily.toleranceEnd - daily.toleranceStart
    : 0

  const abstinenceRate = daily && daily.abstinenceTotal > 0
    ? Math.round((daily.abstinenceSuccess / daily.abstinenceTotal) * 100)
    : null

  if (loading) {
    return (
      <div className="card border-blue-700/50">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-gray-200">📊 일일 리포트</h3>
        </div>
        <p className="text-center text-gray-500 text-sm py-4">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="card border-blue-700/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-200">📊 일일 리포트</h3>
        <span className="text-xs text-gray-500">{date}</span>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800/60 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400 mb-1">총 사용 시간</div>
          <div className="text-lg font-bold text-blue-400">
            {daily ? formatMinutes(daily.totalUsageMin) : '-'}
          </div>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400 mb-1">내성 변화</div>
          <div className={`text-lg font-bold ${toleranceDelta > 0 ? 'text-red-400' : toleranceDelta < 0 ? 'text-green-400' : 'text-gray-400'}`}>
            {toleranceDelta > 0 ? '+' : ''}{toleranceDelta.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-3 text-center">
          <div className="text-xs text-gray-400 mb-1">금욕 성공률</div>
          <div className={`text-lg font-bold ${abstinenceRate === null ? 'text-gray-400' : abstinenceRate >= 70 ? 'text-green-400' : 'text-red-400'}`}>
            {abstinenceRate !== null ? `${abstinenceRate}%` : '-'}
          </div>
        </div>
      </div>

      {/* Category usage breakdown */}
      {usageByCategory.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs text-gray-400 font-medium mb-2">카테고리별 사용량</div>
          {usageByCategory
            .sort((a, b) => b.totalMin - a.totalMin)
            .map(({ cat, totalMin, count }) => {
              const maxMin = Math.max(...usageByCategory.map(u => u.totalMin))
              const barWidth = maxMin > 0 ? (totalMin / maxMin) * 100 : 0
              return (
                <div key={cat.id} className="flex items-center gap-2">
                  <span className="text-base w-6 text-center">{cat.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-gray-300">{cat.name}</span>
                      <span className="text-gray-400">{formatMinutes(totalMin)} ({count}회)</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      ) : (
        <p className="text-center text-gray-500 text-sm py-2">오늘 기록된 사용량이 없습니다.</p>
      )}

      {/* Tolerance range */}
      {daily && (
        <div className="mt-4 pt-3 border-t border-gray-700/50">
          <div className="flex justify-between text-xs text-gray-400">
            <span>내성 시작: <span className="text-gray-300">{daily.toleranceStart.toFixed(1)}%</span></span>
            <span>내성 종료: <span className={`font-medium ${daily.toleranceEnd > daily.toleranceStart ? 'text-red-400' : 'text-green-400'}`}>{daily.toleranceEnd.toFixed(1)}%</span></span>
          </div>
        </div>
      )}
    </div>
  )
}

export default DopamineReport
