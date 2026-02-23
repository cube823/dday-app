-- ============================================================
-- D-Day App - Supabase PostgreSQL Schema
-- Supabase SQL Editor에서 실행하여 클라우드 데이터베이스를 설정합니다.
-- ============================================================


-- ============================================================
-- SECTION 1: Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- SECTION 2: Tables
-- ============================================================

-- 사용자 프로필 (Supabase Auth에 연결)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL DEFAULT '모험가',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 설정 (사용자당 1개)
CREATE TABLE IF NOT EXISTS settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  resignation_date TEXT NOT NULL,
  runway_months INTEGER NOT NULL DEFAULT 12,
  start_date TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 퀘스트 (사용자별)
CREATE TABLE IF NOT EXISTS quests (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  local_id INTEGER,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  completed BOOLEAN NOT NULL DEFAULT false,
  progress INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'normal',
  xp INTEGER NOT NULL DEFAULT 100,
  deadline TEXT,
  completed_at TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 마일스톤 (사용자별, 퀘스트에 연결)
CREATE TABLE IF NOT EXISTS milestones (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quest_id BIGINT NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  local_id INTEGER,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 일별 로그 (사용자별)
CREATE TABLE IF NOT EXISTS daily_logs (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  quests_completed INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);


-- ============================================================
-- SECTION 3: Indexes (성능 최적화)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_quests_user_sort ON quests(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_milestones_quest_sort ON milestones(quest_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);


-- ============================================================
-- SECTION 4: Updated_at 자동 갱신 트리거
-- ============================================================

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- settings 테이블 updated_at 트리거
CREATE OR REPLACE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- quests 테이블 updated_at 트리거
CREATE OR REPLACE TRIGGER trg_quests_updated_at
  BEFORE UPDATE ON quests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- milestones 테이블 updated_at 트리거
CREATE OR REPLACE TRIGGER trg_milestones_updated_at
  BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- daily_logs 테이블 updated_at 트리거
CREATE OR REPLACE TRIGGER trg_daily_logs_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- SECTION 5: 신규 사용자 자동 프로필 생성 트리거
-- (Supabase Auth에서 사용자 가입 시 자동 실행)
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, player_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'player_name', '모험가'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거가 있으면 삭제 후 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- SECTION 6: 신규 프로필 생성 시 기본 설정 자동 생성 트리거
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO settings (user_id, resignation_date)
  VALUES (NEW.id, (CURRENT_DATE + INTERVAL '1 year')::TEXT);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거가 있으면 삭제 후 재생성
DROP TRIGGER IF EXISTS on_profile_created ON profiles;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile();


-- ============================================================
-- SECTION 7: Row Level Security (RLS)
-- 모든 테이블에 RLS 활성화 및 사용자별 접근 정책 설정
-- ============================================================

-- RLS 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

-- ---- profiles 정책 ----
CREATE POLICY "profiles: 본인 조회"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: 본인 삽입"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: 본인 수정"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles: 본인 삭제"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ---- settings 정책 ----
CREATE POLICY "settings: 본인 조회"
  ON settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "settings: 본인 삽입"
  ON settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "settings: 본인 수정"
  ON settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "settings: 본인 삭제"
  ON settings FOR DELETE
  USING (auth.uid() = user_id);

-- ---- quests 정책 ----
CREATE POLICY "quests: 본인 조회"
  ON quests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "quests: 본인 삽입"
  ON quests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "quests: 본인 수정"
  ON quests FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "quests: 본인 삭제"
  ON quests FOR DELETE
  USING (auth.uid() = user_id);

-- ---- milestones 정책 ----
CREATE POLICY "milestones: 본인 조회"
  ON milestones FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "milestones: 본인 삽입"
  ON milestones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "milestones: 본인 수정"
  ON milestones FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "milestones: 본인 삭제"
  ON milestones FOR DELETE
  USING (auth.uid() = user_id);

-- ---- daily_logs 정책 ----
CREATE POLICY "daily_logs: 본인 조회"
  ON daily_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "daily_logs: 본인 삽입"
  ON daily_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_logs: 본인 수정"
  ON daily_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "daily_logs: 본인 삭제"
  ON daily_logs FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- Schema 설정 완료
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요.
-- ============================================================
