import { useState, useEffect } from 'react'

interface AuthProps {
  onAuthSuccess: () => void
  onSkipAuth: () => void
}

type AuthMode = 'signin' | 'signup'

export default function Auth({ onAuthSuccess, onSkipAuth }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<string | null>(null)

  // Supabase 설정 섹션
  const [supabaseConfigured, setSupabaseConfigured] = useState<boolean | null>(null)
  const [showSupabaseSetup, setShowSupabaseSetup] = useState(false)
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    checkSupabaseConfig()
  }, [])

  const checkSupabaseConfig = async () => {
    try {
      const result = await window.electronAPI.isSupabaseConfigured()
      if (result.success) {
        const configured = result.data === true
        setSupabaseConfigured(configured)
        // 설정이 안 되어 있으면 자동으로 펼치기
        if (!configured) {
          setShowSupabaseSetup(true)
        }
      }
    } catch {
      setSupabaseConfigured(false)
      setShowSupabaseSetup(true)
    }
  }

  const handleSupabaseSave = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setError('Supabase URL과 Anon Key를 모두 입력해주세요.')
      return
    }
    setSavingConfig(true)
    setError('')
    try {
      const result = await window.electronAPI.initSupabase(supabaseUrl.trim(), supabaseAnonKey.trim())
      if (result.success) {
        setSupabaseConfigured(true)
        setShowSupabaseSetup(false)
        setSuccessMsg('Supabase 설정이 저장되었습니다!')
        setTimeout(() => setSuccessMsg(''), 3000)
      } else {
        setError(result.error ?? 'Supabase 설정 저장에 실패했습니다.')
      }
    } catch {
      setError('Supabase 설정 중 오류가 발생했습니다.')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('비밀번호가 일치하지 않습니다.')
        return
      }
      if (password.length < 6) {
        setError('비밀번호는 최소 6자 이상이어야 합니다.')
        return
      }
    }

    setLoading(true)
    try {
      const result = mode === 'signup'
        ? await window.electronAPI.signUp(email.trim(), password)
        : await window.electronAPI.signIn(email.trim(), password)

      if (result.success) {
        if (mode === 'signup') {
          setSuccessMsg('회원가입 성공! 이메일을 확인하여 계정을 인증해주세요.')
          setMode('signin')
        } else {
          await window.electronAPI.startSync()
          onAuthSuccess()
        }
      } else {
        setError(translateError(result.error ?? '알 수 없는 오류가 발생했습니다.'))
      }
    } catch {
      setError('서버와 통신 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: string) => {
    setError('')
    setOauthLoading(provider)
    try {
      const result = await window.electronAPI.signInWithOAuth(provider)
      if (result.success && result.data) {
        // OAuth URL을 시스템 기본 브라우저로 열기
        window.open(result.data as string, '_blank')
      } else {
        setError(result.error ?? `${provider} 로그인에 실패했습니다.`)
      }
    } catch {
      setError(`${provider} 로그인 중 오류가 발생했습니다.`)
    } finally {
      setOauthLoading(null)
    }
  }

  const translateError = (error: string): string => {
    const errorMap: Record<string, string> = {
      'Invalid login credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
      'Email not confirmed': '이메일 인증이 필요합니다. 이메일을 확인해주세요.',
      'User already registered': '이미 가입된 이메일입니다.',
      'Password should be at least 6 characters': '비밀번호는 최소 6자 이상이어야 합니다.',
      'Unable to validate email address: invalid format': '올바른 이메일 형식이 아닙니다.',
      'Email rate limit exceeded': '잠시 후 다시 시도해주세요.',
    }
    for (const [key, value] of Object.entries(errorMap)) {
      if (error.includes(key)) return value
    }
    return error
  }

  const switchMode = () => {
    setMode(prev => prev === 'signin' ? 'signup' : 'signin')
    setError('')
    setSuccessMsg('')
    setPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-8">
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-600/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-900/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-600/20 border-2 border-amber-500/50 mb-4 text-3xl">
            ⚔️
          </div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
            Quest Log
          </h1>
          <p className="text-gray-400 mt-1 text-sm">퇴사 대작전</p>
        </div>

        {/* 메인 카드 */}
        <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 overflow-hidden">
          {/* 탭 스위처 */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => mode !== 'signin' && switchMode()}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-200 ${
                mode === 'signin'
                  ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-400/5'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              🗝️ 로그인
            </button>
            <button
              onClick={() => mode !== 'signup' && switchMode()}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-200 ${
                mode === 'signup'
                  ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-400/5'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              📜 회원가입
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* 성공 메시지 */}
            {successMsg && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-green-900/30 border border-green-700/50 rounded-lg text-sm text-green-300">
                <span className="flex-shrink-0 mt-0.5">✅</span>
                <span>{successMsg}</span>
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <div className="flex items-start gap-2.5 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-300">
                <span className="flex-shrink-0 mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* 이메일/비밀번호 폼 */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  이메일
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="hero@questlog.gg"
                  className="input-field w-full text-sm"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field w-full text-sm"
                  disabled={loading}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                    비밀번호 확인
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field w-full text-sm"
                    disabled={loading}
                    autoComplete="new-password"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{mode === 'signin' ? '로그인 중...' : '가입 중...'}</span>
                  </>
                ) : (
                  <span>{mode === 'signin' ? '⚔️ 모험 시작' : '📜 용사 등록'}</span>
                )}
              </button>
            </form>

            {/* 구분선 */}
            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">또는</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* OAuth 버튼들 */}
            <div className="space-y-2.5">
              <button
                onClick={() => handleOAuth('google')}
                disabled={!!oauthLoading || loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-gray-500 rounded-lg text-sm font-medium text-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === 'google' ? (
                  <span className="inline-block w-4 h-4 border-2 border-gray-400/30 border-t-gray-300 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Google로 계속하기
              </button>

              <button
                onClick={() => handleOAuth('github')}
                disabled={!!oauthLoading || loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-gray-500 rounded-lg text-sm font-medium text-gray-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {oauthLoading === 'github' ? (
                  <span className="inline-block w-4 h-4 border-2 border-gray-400/30 border-t-gray-300 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                )}
                GitHub로 계속하기
              </button>
            </div>

            {/* 오프라인 모드 버튼 */}
            <button
              onClick={onSkipAuth}
              disabled={loading || !!oauthLoading}
              className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🏕️ 오프라인 모드로 계속하기
            </button>
          </div>
        </div>

        {/* Supabase 설정 섹션 */}
        <div className="mt-4 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowSupabaseSetup(prev => !prev)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className={`inline-block w-2 h-2 rounded-full ${supabaseConfigured ? 'bg-green-400' : 'bg-amber-400 animate-pulse'}`} />
              <span className="font-medium">
                {supabaseConfigured === null
                  ? 'Supabase 설정 확인 중...'
                  : supabaseConfigured
                    ? 'Supabase 연결됨'
                    : 'Supabase 설정 필요'}
              </span>
            </span>
            <span className={`transition-transform duration-200 ${showSupabaseSetup ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </button>

          {showSupabaseSetup && (
            <div className="px-5 pb-5 space-y-4 border-t border-gray-700 pt-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                클라우드 동기화를 사용하려면 Supabase 프로젝트 정보를 입력하세요.
                <a
                  href="https://supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-amber-400 hover:text-amber-300 underline"
                  onClick={e => { e.preventDefault(); window.open('https://supabase.com', '_blank') }}
                >
                  supabase.com
                </a>
                에서 무료로 시작할 수 있어요.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  Project URL
                </label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={e => setSupabaseUrl(e.target.value)}
                  placeholder="https://xxxxxxxxxxxx.supabase.co"
                  className="input-field w-full text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">
                  Anon Key
                </label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={e => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="input-field w-full text-sm font-mono"
                />
              </div>

              <button
                onClick={handleSupabaseSave}
                disabled={savingConfig || !supabaseUrl.trim() || !supabaseAnonKey.trim()}
                className="w-full btn-primary py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingConfig ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>저장 중...</span>
                  </>
                ) : (
                  '설정 저장'
                )}
              </button>
            </div>
          )}
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-xs text-gray-600 mt-4">
          Quest Log — 퇴사 대작전 · 모험가의 여정은 계속된다
        </p>
      </div>
    </div>
  )
}
