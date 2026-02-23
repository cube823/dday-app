import { useState, useEffect, useCallback } from 'react'
import HeroStatus from './components/HeroStatus'
import DDay from './components/DDay'
import DailyQuest from './components/DailyQuest'
import QuestBoard from './components/QuestBoard'
import Runway from './components/Runway'
import Auth from './components/Auth'
import { Settings, Quest } from './types'
import * as api from './api/client'

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [quests, setQuests] = useState<Quest[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const result = await window.electronAPI.getSession()
      if (result.success && result.data) {
        setAuthenticated(true)
        loadSettings()
      } else {
        setAuthenticated(false)
      }
    } catch {
      // Supabase 미설정 또는 오프라인 - 인증 화면 표시
      setAuthenticated(false)
    }
  }

  const handleAuthSuccess = () => {
    setAuthenticated(true)
    loadSettings()
  }

  const handleSkipAuth = () => {
    setAuthenticated(true)
    loadSettings()
  }

  const loadSettings = async () => {
    try {
      const data = await api.getSettings()
      setSettings(data)
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const handleSettingsUpdate = async (newSettings: Settings) => {
    await api.updateSettings(newSettings)
    setSettings(newSettings)
    setRefreshKey(prev => prev + 1)
  }

  const handleNameUpdate = async (name: string) => {
    if (!settings) return
    const updated = { ...settings, playerName: name }
    await api.updateSettings({ playerName: name } as Partial<Settings>)
    setSettings(updated)
  }

  const handleQuestComplete = useCallback(() => {
    loadSettings() // Refresh settings (XP, level, streak)
    setRefreshKey(prev => prev + 1)
  }, [])

  const handleQuestsLoaded = useCallback((loadedQuests: Quest[]) => {
    setQuests(loadedQuests)
  }, [])

  // 인증 상태 확인 중
  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-xl mb-4">로딩 중...</div>
        </div>
      </div>
    )
  }

  // 미인증 상태 → Auth 화면
  if (!authenticated) {
    return <Auth onAuthSuccess={handleAuthSuccess} onSkipAuth={handleSkipAuth} />
  }

  // 설정 로딩 대기
  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-xl mb-4">데이터 불러오는 중...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
            Quest Log — 퇴사 대작전
          </h1>
          <p className="text-gray-400 mt-2">모험가여, 새로운 세계가 기다리고 있다</p>
        </header>

        <div className="space-y-6">
          {/* Hero Status Bar */}
          <HeroStatus
            settings={settings}
            quests={quests}
            onNameUpdate={handleNameUpdate}
          />

          {/* D-Day Counter */}
          <DDay
            key={`dday-${refreshKey}`}
            settings={settings}
            quests={quests}
            onSettingsUpdate={handleSettingsUpdate}
          />

          {/* Daily Quest */}
          <DailyQuest
            quests={quests}
            onCompleteQuest={async (id) => {
              try {
                await api.completeQuest(id)
                handleQuestComplete()
              } catch {
                // Quest board will handle this
              }
            }}
          />

          {/* Quest Board */}
          <QuestBoard
            key={`quests-${refreshKey}`}
            onQuestComplete={handleQuestComplete}
            onQuestsLoaded={handleQuestsLoaded}
            refreshTrigger={refreshKey}
          />

          {/* Runway Tracker */}
          <Runway
            key={`runway-${refreshKey}`}
            settings={settings}
            onSettingsUpdate={handleSettingsUpdate}
          />
        </div>
      </div>
    </div>
  )
}

export default App
