import { ipcMain } from 'electron';
import {
  signUp,
  signIn,
  signInWithOAuth,
  signOut,
  getSession,
  getUser,
  isSupabaseConfigured,
  initSupabase,
} from './supabase';
import { startSync, stopSync, fullSync, getSyncStatus } from './sync';

export function registerAuthHandlers(): void {
  // Auth: 회원가입
  ipcMain.handle('auth:signUp', async (_e, { email, password }) => {
    try {
      const data = await signUp(email, password);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Auth: 이메일/비밀번호 로그인
  ipcMain.handle('auth:signIn', async (_e, { email, password }) => {
    try {
      const data = await signIn(email, password);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Auth: OAuth 로그인 (Google, GitHub 등)
  ipcMain.handle('auth:signInWithOAuth', async (_e, provider) => {
    try {
      const data = await signInWithOAuth(provider);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Auth: 로그아웃 (동기화 중지 후 로그아웃)
  ipcMain.handle('auth:signOut', async (_e) => {
    try {
      stopSync();
      const data = await signOut();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Auth: 현재 세션 조회
  ipcMain.handle('auth:getSession', async () => {
    try {
      const data = await getSession();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Auth: 현재 사용자 조회
  ipcMain.handle('auth:getUser', async () => {
    try {
      const data = await getUser();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Auth: Supabase 설정 여부 확인
  ipcMain.handle('auth:isConfigured', async () => {
    try {
      const data = isSupabaseConfigured();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Auth: Supabase 초기화 (URL + anon key)
  ipcMain.handle('auth:initSupabase', async (_e, { url, anonKey }) => {
    try {
      initSupabase(url, anonKey);
      const data = undefined;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Sync: 동기화 시작
  ipcMain.handle('sync:start', async () => {
    try {
      const data = await startSync();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Sync: 동기화 중지
  ipcMain.handle('sync:stop', async () => {
    try {
      const data = stopSync();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Sync: 즉시 전체 동기화 실행
  ipcMain.handle('sync:now', async () => {
    try {
      const data = await fullSync();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Sync: 동기화 상태 조회
  ipcMain.handle('sync:status', async () => {
    try {
      const data = getSyncStatus();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
