import { Quest } from '../types'

interface DailyQuestProps {
  quests: Quest[]
  onCompleteQuest: (id: number) => void
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'badge-easy',
  normal: 'badge-normal',
  hard: 'badge-hard',
  epic: 'badge-epic',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  epic: 'Epic',
}

function getDaysUntilDeadline(deadline: string | null): number | null {
  if (!deadline) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dl = new Date(deadline)
  dl.setHours(0, 0, 0, 0)
  return Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function DailyQuest({ quests, onCompleteQuest }: DailyQuestProps) {
  const incomplete = quests.filter(q => !q.completed)

  // Sort: deadline soonest first, then highest progress
  const sorted = [...incomplete].sort((a, b) => {
    const aDays = getDaysUntilDeadline(a.deadline)
    const bDays = getDaysUntilDeadline(b.deadline)

    if (aDays !== null && bDays === null) return -1
    if (aDays === null && bDays !== null) return 1
    if (aDays !== null && bDays !== null) return aDays - bDays

    return b.progress - a.progress
  })

  const todayQuests = sorted.slice(0, 3)
  const allDone = incomplete.length === 0

  if (todayQuests.length === 0 && !allDone) return null

  return (
    <div className="card border-amber-700/30">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">
          ⚔️ 오늘의 퀘스트
        </h2>
        {!allDone && (
          <span className="text-sm text-gray-400">
            목표: {todayQuests.length}개 클리어!
          </span>
        )}
      </div>

      {allDone ? (
        <div className="text-center py-6">
          <div className="text-4xl mb-3">🏆</div>
          <div className="text-xl font-bold text-amber-400">오늘의 퀘스트 올 클리어!</div>
          <div className="text-sm text-gray-400 mt-1">멋진 모험가네요!</div>
        </div>
      ) : todayQuests.length === 0 ? null : (
        <div className="space-y-3">
          {todayQuests.every(q => !q.deadline) && (
            <div className="text-sm text-gray-400 mb-2">
              오늘 집중할 퀘스트를 골라보세요
            </div>
          )}
          {todayQuests.map((quest) => {
            const daysLeft = getDaysUntilDeadline(quest.deadline)
            return (
              <div
                key={quest.id}
                className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600 hover:border-amber-600/50 transition-colors"
              >
                <button
                  onClick={() => onCompleteQuest(quest.id)}
                  className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-amber-500/50 hover:border-amber-400 hover:bg-amber-500/20 flex items-center justify-center transition-all"
                  title="퀘스트 클리어!"
                >
                  <span className="text-amber-400 text-sm">⚔️</span>
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{quest.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${DIFFICULTY_COLORS[quest.difficulty]}`}>
                      {DIFFICULTY_LABELS[quest.difficulty]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-600 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all"
                        style={{ width: `${quest.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{quest.progress}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {daysLeft !== null && (
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      daysLeft <= 0 ? 'bg-red-900/50 text-red-400' :
                      daysLeft <= 3 ? 'bg-orange-900/50 text-orange-400' :
                      'bg-gray-600 text-gray-300'
                    }`}>
                      {daysLeft <= 0 ? '마감!' : `D-${daysLeft}`}
                    </span>
                  )}
                  <span className="text-xs text-amber-400 font-medium">+{quest.xp}XP</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default DailyQuest
