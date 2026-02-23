# 도파민 관리 시스템 설계

## 개요

퇴사 준비 RPG 앱에 **도파민 내성(Dopamine Tolerance)** 시스템을 추가한다.
저급 도파민(SNS, 쇼츠, 게임 등)을 줄이고, 고급 도파민(생산적 활동)을 추구하는 습관을 게임화한다.

핵심 비유: 저급 도파민을 많이 소비할수록 **내성이 올라가** 어떤 활동에서도 만족감을 못 느끼게 되고, 절제할수록 **내성이 낮아져** 작은 성취에도 큰 보상감을 느끼게 된다.

---

## 1. 핵심 컨셉: 도파민 내성 레벨

### 내성 수치

- **범위**: 0~100
- **높을수록 나쁨** (저급 도파민에 중독된 상태)
- **낮을수록 좋음** (뇌가 리셋된 상태)

### 수치 변동

| 이벤트 | 내성 변화 |
|--------|----------|
| 자연 회복 (하루 저급 도파민 미사용) | -3 |
| 금욕 타이머 성공 보너스 | -2 |
| 퀘스트 완료 (난이도별) | -2 ~ -5 |
| SNS 사용 (분당) | +0.15 |
| 영상 시청 (분당) | +0.2 |
| 게임 (분당) | +0.25 |
| 쇼츠/릴스 (분당) | +0.3 |

### RPG 스탯 연동

내성 구간에 따라 캐릭터 스탯이 변동된다.

| 내성 구간 | 상태명 | 의지력 | 집중력 | 특수 효과 |
|----------|--------|--------|--------|----------|
| 0~20 | "각성 상태" | +3 | +3 | - |
| 21~40 | "맑은 정신" | +2 | +2 | - |
| 41~60 | "보통" | 0 | 0 | - |
| 61~80 | "흐릿한 정신" | -1 | -1 | - |
| 81~100 | "도파민 과부하" | -2 | -2 | XP 획득량 -20% |

---

## 2. 타이머 & 기록 메커니즘

### 저급 도파민 타이머

1. 사용자가 저급 도파민 활동 **시작 시** 카테고리를 선택하고 타이머 시작
2. 타이머 진행 중 **실시간으로 내성 수치 상승**을 시각적으로 표시
3. 타이머 종료 시 **결산 화면** 표시: "SNS 47분 사용 -> 내성 +8 상승"

### 금욕 타이머 (핵심 기능)

1. "오늘 SNS 안 하기" 같은 **도전 타이머** 설정
2. 하루가 끝날 때까지 타이머를 깨지 않으면:
   - 내성 자연 감소(-3) + 보너스 감소(-2)
3. 타이머를 깨면(저급 도파민 사용):
   - 내성 증가 + 연속 기록 리셋
4. **연속 금욕 일수** 추적: 3일, 7일, 14일, 30일마다 마일스톤 보상

### 하루 요약 리포트

- 저급 도파민 총 사용 시간
- 내성 변화량 (상승/하락)
- 금욕 타이머 성공/실패 현황

---

## 3. 카테고리

### 프리셋

| 아이콘 | 카테고리 | 분당 내성 증가율 |
|--------|---------|----------------|
| 📱 | SNS (인스타, 트위터, 페이스북) | 0.15 |
| 📺 | 영상 (유튜브, 넷플릭스) | 0.2 |
| 🎮 | 게임 (모바일, PC, 콘솔) | 0.25 |
| 📱 | 쇼츠/릴스 | 0.3 |
| 🛒 | 쇼핑 (쿠팡, 무신사) | 0.15 |
| 🍺 | 음주/야식 | 0.2 |

### 커스텀

사용자가 직접 이름, 아이콘, 내성 증가율을 정의하여 추가 가능.

---

## 4. UI 구성

### 새 탭: "도파민 랩"

기존 앱 네비게이션에 탭 추가.

```
+-------------------------------------+
|  🧠 도파민 내성 게이지              |
|  ████████░░░░░░░░░░  38/100        |
|  상태: "맑은 정신"                   |
|  의지력 +2  |  집중력 +2            |
+-------------------------------------+
|  ⏱️ 금욕 타이머                     |
|  +------+ +------+ +------+        |
|  |📱 SNS| |📺 영상| |🎮 게임|       |
|  |12:34 | | OFF  | |05:21 |        |
|  |진행중 | |성공   | |진행중 |       |
|  +------+ +------+ +------+        |
|  연속 금욕: 🔥 5일                  |
+-------------------------------------+
|  📊 오늘의 도파민 리포트            |
|  저급 사용: 1시간 23분              |
|  내성 변화: -4 (잘하고 있어요!)     |
|  금욕 성공: 2/3 카테고리            |
+-------------------------------------+
```

### 컴포넌트 구조

| 컴포넌트 | 역할 |
|---------|------|
| `DopamineLab.tsx` | 메인 컨테이너 (탭) |
| `ToleranceGauge.tsx` | 내성 게이지 + 상태 표시 + 스탯 |
| `AbstinenceTimer.tsx` | 금욕 타이머 카드들 (카테고리별) |
| `DopamineReport.tsx` | 하루 요약 리포트 |
| `DopamineSettings.tsx` | 카테고리 관리 (프리셋 + 커스텀 추가) |

### 기존 컴포넌트 연동

- `HeroStatus.tsx`: 스탯(의지력, 집중력) 표시 추가
- `QuestBoard.tsx`: 퀘스트 완료 시 내성 감소 반영

---

## 5. 데이터 모델

### 새 테이블

```sql
-- 도파민 카테고리 (프리셋 + 커스텀)
CREATE TABLE dopamine_categories (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  icon            TEXT NOT NULL,
  tolerance_rate  REAL NOT NULL DEFAULT 0.2,
  is_preset       INTEGER NOT NULL DEFAULT 0,
  is_active       INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- 도파민 활동 기록 (타이머 로그)
CREATE TABLE dopamine_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id     INTEGER NOT NULL REFERENCES dopamine_categories(id),
  started_at      TEXT NOT NULL,
  ended_at        TEXT,
  duration_min    REAL,
  tolerance_gain  REAL,
  date            TEXT NOT NULL
);

-- 금욕 타이머
CREATE TABLE abstinence_timers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id     INTEGER NOT NULL REFERENCES dopamine_categories(id),
  date            TEXT NOT NULL,
  started_at      TEXT NOT NULL,
  broken_at       TEXT,
  is_success      INTEGER NOT NULL DEFAULT 0
);

-- 도파민 일일 스냅샷
CREATE TABLE dopamine_daily (
  date                TEXT PRIMARY KEY,
  tolerance_start     REAL NOT NULL,
  tolerance_end       REAL NOT NULL,
  total_usage_min     REAL NOT NULL DEFAULT 0,
  abstinence_success  INTEGER NOT NULL DEFAULT 0,
  abstinence_total    INTEGER NOT NULL DEFAULT 0
);
```

### settings 테이블 확장

```sql
ALTER TABLE settings ADD COLUMN dopamine_tolerance REAL DEFAULT 50;
ALTER TABLE settings ADD COLUMN stat_willpower INTEGER DEFAULT 0;
ALTER TABLE settings ADD COLUMN stat_focus INTEGER DEFAULT 0;
ALTER TABLE settings ADD COLUMN abstinence_streak INTEGER DEFAULT 0;
```

### 핵심 로직 흐름

1. **타이머 시작** → `dopamine_logs` INSERT (ended_at = NULL)
2. **타이머 종료** → UPDATE ended_at, duration_min 계산, tolerance_gain 반영 → settings.dopamine_tolerance 증가
3. **금욕 깨짐** → `abstinence_timers` broken_at 기록 + 내성 증가 + 연속 기록 리셋
4. **하루 마감** → `dopamine_daily` 스냅샷 저장, 자연 감소(-3) 적용, 스탯 재계산
5. **퀘스트 완료** → 기존 XP 로직 + 내성 추가 감소(-2~-5)

---

## 6. 구현 범위

### Phase 1: 코어 시스템
- DB 스키마 추가 (테이블 + settings 컬럼)
- 도파민 카테고리 프리셋 시딩
- 내성 계산 로직 (증가/감소/자연회복)
- 스탯 계산 로직

### Phase 2: 타이머 UI
- DopamineLab 탭 추가
- ToleranceGauge 컴포넌트
- AbstinenceTimer 컴포넌트 (금욕 타이머)
- 실시간 내성 변화 표시

### Phase 3: 리포트 & 연동
- DopamineReport 컴포넌트
- HeroStatus 스탯 표시 연동
- 퀘스트 완료 시 내성 감소 연동
- DopamineSettings (카테고리 관리)

### Phase 4: Supabase 동기화
- 새 테이블들의 클라우드 스키마 추가
- 동기화 로직 확장
