import { useState, useEffect } from 'react'
import { Settings } from '../types'

interface RunwayProps {
  settings: Settings
  onSettingsUpdate: (settings: Settings) => void
}

function Runway({ settings, onSettingsUpdate }: RunwayProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editMonths, setEditMonths] = useState(settings.runwayMonths)
  const [editStartDate, setEditStartDate] = useState(settings.startDate || '')
  const [daysElapsed, setDaysElapsed] = useState(0)
  const [daysRemaining, setDaysRemaining] = useState(0)
  const [progressPercentage, setProgressPercentage] = useState(0)

  useEffect(() => {
    if (settings.startDate) {
      calculateRunway()
      const interval = setInterval(calculateRunway, 60000) // Update every minute
      return () => clearInterval(interval)
    }
  }, [settings.startDate, settings.runwayMonths])

  const calculateRunway = () => {
    if (!settings.startDate) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const startDate = new Date(settings.startDate)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + settings.runwayMonths)

    const totalTime = endDate.getTime() - startDate.getTime()
    const elapsedTime = today.getTime() - startDate.getTime()
    const remainingTime = endDate.getTime() - today.getTime()

    const elapsed = Math.max(0, Math.floor(elapsedTime / (1000 * 60 * 60 * 24)))
    const remaining = Math.max(0, Math.ceil(remainingTime / (1000 * 60 * 60 * 24)))
    const percentage = Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100))

    setDaysElapsed(elapsed)
    setDaysRemaining(remaining)
    setProgressPercentage(percentage)
  }

  const handleSave = () => {
    onSettingsUpdate({
      ...settings,
      runwayMonths: editMonths,
      startDate: editStartDate || null
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditMonths(settings.runwayMonths)
    setEditStartDate(settings.startDate || '')
    setIsEditing(false)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const getStatusColor = () => {
    if (!settings.startDate) return 'text-gray-400'
    if (progressPercentage >= 90) return 'text-red-400'
    if (progressPercentage >= 70) return 'text-orange-400'
    if (progressPercentage >= 50) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getProgressColor = () => {
    if (progressPercentage >= 90) return 'bg-red-500'
    if (progressPercentage >= 70) return 'bg-orange-500'
    if (progressPercentage >= 50) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const totalDays = settings.runwayMonths * 30 // Approximate

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">💰 런웨이 트래커</h2>
          <p className="text-gray-400 text-sm">퇴사 후 생존 가능 기간</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="btn-secondary text-sm"
          >
            설정 수정
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">런웨이 기간 (개월)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={editMonths}
              onChange={(e) => setEditMonths(parseInt(e.target.value))}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">퇴사일 (선택사항)</label>
            <input
              type="date"
              value={editStartDate}
              onChange={(e) => setEditStartDate(e.target.value)}
              className="input-field w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              퇴사일을 설정하면 실시간 런웨이 추적이 시작됩니다
            </p>
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
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">총 런웨이</div>
              <div className="text-3xl font-bold text-primary-400">
                {settings.runwayMonths}개월
              </div>
              <div className="text-sm text-gray-500 mt-1">
                약 {totalDays}일
              </div>
            </div>

            {settings.startDate ? (
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">퇴사일</div>
                <div className="text-lg font-semibold text-gray-200">
                  {formatDate(settings.startDate)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {daysElapsed}일 경과
                </div>
              </div>
            ) : (
              <div className="bg-gray-700 rounded-lg p-4 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-sm">퇴사일 미설정</div>
                  <div className="text-xs mt-1">설정하여 추적 시작</div>
                </div>
              </div>
            )}
          </div>

          {settings.startDate && (
            <>
              <div className="text-center">
                <div className={`text-6xl font-bold mb-3 ${getStatusColor()}`}>
                  {daysRemaining}
                </div>
                <div className="text-xl font-semibold text-gray-300">
                  일 남음
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>런웨이 소진율</span>
                  <span>{progressPercentage.toFixed(1)}%</span>
                </div>
                <div className="progress-bar h-4">
                  <div
                    className={`progress-fill ${getProgressColor()}`}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>퇴사일</span>
                  <span>런웨이 종료</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-700">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">
                    {daysElapsed}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">경과일</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-400">
                    {daysRemaining}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">잔여일</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary-400">
                    {Math.floor(daysRemaining / 30)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">잔여월</div>
                </div>
              </div>

              {progressPercentage >= 70 && (
                <div className={`p-4 rounded-lg ${
                  progressPercentage >= 90 ? 'bg-red-900/30 border border-red-700' : 'bg-orange-900/30 border border-orange-700'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <div className="font-semibold">
                        {progressPercentage >= 90 ? '긴급: 런웨이 거의 소진' : '주의: 런웨이 70% 소진'}
                      </div>
                      <div className="text-sm text-gray-300 mt-1">
                        수입원 확보 또는 지출 절감이 필요합니다
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {!settings.startDate && (
            <div className="text-center py-8 bg-gray-700 rounded-lg">
              <div className="text-gray-400 mb-4">
                퇴사일을 설정하여 런웨이 추적을 시작하세요
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="btn-primary"
              >
                퇴사일 설정하기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Runway
