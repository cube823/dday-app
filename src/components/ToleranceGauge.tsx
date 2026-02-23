import { useMemo } from 'react'

interface ToleranceGaugeProps {
  tolerance: number
  statWillpower: number
  statFocus: number
}

const TOLERANCE_STATES = [
  { max: 20, name: '각성 상태', emoji: '🧘', color: 'green', willpower: 3, focus: 3 },
  { max: 40, name: '맑은 정신', emoji: '✨', color: 'blue', willpower: 2, focus: 2 },
  { max: 60, name: '보통', emoji: '😐', color: 'yellow', willpower: 0, focus: 0 },
  { max: 80, name: '흐릿한 정신', emoji: '😵‍💫', color: 'orange', willpower: -1, focus: -1 },
  { max: 100, name: '도파민 과부하', emoji: '🤯', color: 'red', willpower: -2, focus: -2 },
]

function getGaugeColor(tolerance: number): string {
  if (tolerance <= 20) return 'from-green-600 to-green-400'
  if (tolerance <= 40) return 'from-blue-600 to-blue-400'
  if (tolerance <= 60) return 'from-yellow-600 to-yellow-400'
  if (tolerance <= 80) return 'from-orange-600 to-orange-400'
  return 'from-red-600 to-red-400'
}

function getBorderColor(tolerance: number): string {
  if (tolerance <= 20) return 'border-green-700/50'
  if (tolerance <= 40) return 'border-blue-700/50'
  if (tolerance <= 60) return 'border-yellow-700/50'
  if (tolerance <= 80) return 'border-orange-700/50'
  return 'border-red-700/50'
}

function ToleranceGauge({ tolerance, statWillpower, statFocus }: ToleranceGaugeProps) {
  const clamped = Math.max(0, Math.min(100, tolerance))
  const state = useMemo(() => {
    return TOLERANCE_STATES.find(s => clamped <= s.max) || TOLERANCE_STATES[TOLERANCE_STATES.length - 1]
  }, [clamped])

  const percentage = clamped

  return (
    <div className={`card ${getBorderColor(clamped)}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{state.emoji}</span>
          <div>
            <h3 className="text-lg font-bold text-gray-200">🧠 도파민 내성</h3>
            <span className="text-sm text-gray-400">{state.name}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-200">
            {Math.round(clamped)}<span className="text-sm text-gray-500">/100</span>
          </div>
        </div>
      </div>

      {/* Gauge Bar */}
      <div className="h-4 rounded-full overflow-hidden bg-gray-700 border border-gray-600 mb-3">
        <div
          className={`h-full bg-gradient-to-r ${getGaugeColor(clamped)} transition-all duration-700 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">💪</span>
          <span className="text-xs text-gray-400">의지력</span>
          <span className={`text-sm font-bold ${statWillpower > 0 ? 'text-blue-400' : statWillpower < 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {statWillpower > 0 ? '+' : ''}{statWillpower}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🎯</span>
          <span className="text-xs text-gray-400">집중력</span>
          <span className={`text-sm font-bold ${statFocus > 0 ? 'text-cyan-400' : statFocus < 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {statFocus > 0 ? '+' : ''}{statFocus}
          </span>
        </div>
        {clamped > 80 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-red-400 font-medium">⚠️ XP -20%</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ToleranceGauge
