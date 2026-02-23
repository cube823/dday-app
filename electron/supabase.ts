import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient, AuthChangeEvent, Session } from '@supabase/supabase-js';

// Supabase 설정 파일 인터페이스
interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// 싱글톤 클라이언트 인스턴스
let supabaseClient: SupabaseClient | null = null;

// 설정 파일 경로 반환 (userData 디렉토리 기준)
function getConfigFilePath(): string {
  return path.join(app.getPath('userData'), 'supabase-config.json');
}

// 설정 파일에서 Supabase 설정 로드
function loadConfigFromFile(): SupabaseConfig | null {
  try {
    const configPath = getConfigFilePath();
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as SupabaseConfig;
    if (parsed.url && parsed.anonKey) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// 설정 파일에 Supabase 설정 저장
function saveConfigToFile(url: string, anonKey: string): void {
  const configPath = getConfigFilePath();
  const config: SupabaseConfig = { url, anonKey };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

// 앱 시작 시 환경변수 또는 파일에서 클라이언트 초기화
function initializeClient(): void {
  // 환경변수 우선 확인
  const envUrl = process.env.SUPABASE_URL;
  const envKey = process.env.SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    supabaseClient = createClient(envUrl, envKey);
    return;
  }

  // 환경변수 없으면 설정 파일 확인
  const fileConfig = loadConfigFromFile();
  if (fileConfig) {
    supabaseClient = createClient(fileConfig.url, fileConfig.anonKey);
    return;
  }

  // 설정 없음 - 오프라인 모드로 동작
  supabaseClient = null;
}

// 모듈 로드 시 자동 초기화
initializeClient();

/**
 * Supabase 클라이언트 인스턴스 반환
 * 설정되지 않은 경우 null 반환
 */
export function getSupabaseClient(): SupabaseClient | null {
  return supabaseClient;
}

/**
 * Supabase가 설정되어 있는지 여부 반환
 */
export function isSupabaseConfigured(): boolean {
  return supabaseClient !== null;
}

/**
 * Supabase 클라이언트 초기화 또는 재설정
 * 설정을 파일에 저장하여 앱 재시작 시에도 유지
 */
export function initSupabase(url: string, anonKey: string): void {
  supabaseClient = createClient(url, anonKey);
  saveConfigToFile(url, anonKey);
}

// 클라이언트가 설정되어 있는지 검증하고 없으면 에러 throw
function requireClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error(
      'Supabase가 설정되지 않았습니다. initSupabase()를 먼저 호출하거나 환경변수(SUPABASE_URL, SUPABASE_ANON_KEY)를 설정하세요.'
    );
  }
  return supabaseClient;
}

/**
 * 이메일/비밀번호로 회원가입
 */
export async function signUp(email: string, password: string) {
  const client = requireClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/**
 * 이메일/비밀번호로 로그인
 */
export async function signIn(email: string, password: string) {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * OAuth 로그인 (Google, GitHub)
 * OAuth 플로우를 위한 URL 반환
 */
export async function signInWithOAuth(provider: 'google' | 'github'): Promise<string> {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) {
    throw new Error(`OAuth URL을 가져오지 못했습니다 (provider: ${provider})`);
  }
  return data.url;
}

/**
 * 로그아웃
 */
export async function signOut(): Promise<void> {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

/**
 * 현재 세션 반환
 * 세션이 없으면 null 반환
 */
export async function getSession(): Promise<Session | null> {
  const client = requireClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

/**
 * 현재 로그인된 사용자 반환
 * 로그인되지 않은 경우 null 반환
 */
export async function getUser() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user;
}

/**
 * 인증 상태 변경 구독
 * 구독 해제 함수 반환
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  const client = requireClient();
  const { data: { subscription } } = client.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
