import { Quest } from '../types'

export type UrgencyLevel = 'safe' | 'warning' | 'urgent' | 'danger'

export function getUrgency(quest: Quest): UrgencyLevel {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (quest.deadline) {
    const dl = new Date(quest.deadline)
    dl.setHours(0, 0, 0, 0)
    const daysLeft = Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 0) return 'danger'
    if (daysLeft <= 2) return 'urgent'
    if (daysLeft <= 6) return 'warning'
    return 'safe'
  }

  if (quest.createdAt) {
    const created = new Date(quest.createdAt)
    created.setHours(0, 0, 0, 0)
    const daysOld = Math.ceil((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    if (daysOld >= 30) return 'danger'
    if (daysOld >= 21) return 'urgent'
    if (daysOld >= 14) return 'warning'
  }

  return 'safe'
}

export const URGENCY_BADGE: Record<UrgencyLevel, string | null> = {
  safe: null,
  warning: '🟡 주의',
  urgent: '🟠 급박',
  danger: '🔴 위험',
}

export const URGENCY_BORDER: Record<UrgencyLevel, string> = {
  safe: 'border-gray-600',
  warning: 'border-yellow-500',
  urgent: 'border-orange-500 urgency-pulse',
  danger: 'border-red-500 urgency-shake',
}
