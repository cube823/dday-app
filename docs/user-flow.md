# D-Day App 유저 플로우

## 앱 개요

퇴사 목표일(D-Day)까지의 자기 개발을 RPG 퀘스트 시스템으로 게이미피케이션한 Electron 데스크톱 앱.
퀘스트 완료로 XP/레벨을 올리고, 도파민 사용을 추적하여 내성(tolerance)을 관리한다.

---

## 화면 구조

React Router 없이 상태 기반으로 화면을 전환한다.

```
앱 시작
  ├─ 인증 미완료 → Auth 화면
  └─ 인증 완료 → 메인 레이아웃
       ├─ HeroStatus (항상 상단 고정)
       ├─ 탭: ⚔️ 퀘스트 (기본)
       │    ├─ DDay 카드
       │    ├─ 오늘의 퀘스트
       │    ├─ 퀘스트 보드
       │    └─ 런웨이 트래커
       └─ 탭: 🧠 도파민 랩
            ├─ 내성 게이지
            ├─ 도파민 사용 추적
            ├─ 금욕 타이머
            └─ 일일 리포트
```

---

## 1. Auth (인증 화면)

사용자가 앱을 처음 실행하면 인증 화면이 표시된다.

### 플로우

```
앱 실행
  ├─ Supabase 미설정 → 설정 패널 자동 펼침
  │    └─ URL + anon key 입력 → initSupabase()
  │
  ├─ 이메일 로그인
  │    ├─ 로그인 모드: signIn(email, password)
  │    └─ 회원가입 모드: signUp(email, password)
  │
  ├─ OAuth 로그인
  │    ├─ Google: signInWithOAuth('google')
  │    └─ GitHub: signInWithOAuth('github')
  │
  └─ 오프라인 모드
       └─ 인증 없이 로컬 DB만 사용하여 메인 화면으로 이동
```

### 인증 성공 후

1. `startSync()` 호출 → 30초 간격 클라우드 동기화 시작
2. `getSettings()` 호출 → 전역 설정 로드
3. 메인 레이아웃 렌더링

---

## 2. HeroStatus (플레이어 상태바)

메인 화면 상단에 항상 표시되는 RPG 스타일 상태바.

### 표시 정보

| 항목 | 설명 | 데이터 출처 |
|------|------|-------------|
| 플레이어 이름 | 클릭 시 인라인 편집 가능 | `settings.playerName` |
| 레벨 | 아이콘 + 숫자 | `settings.level` |
| XP 바 | 현재 XP / 다음 레벨 필요 XP | `settings.totalXp` (레벨당 `level × 150` XP 필요) |
| 연속 기록 🔥 | 연속 활동 일수 | `settings.currentStreak` |
| 오늘 완료 수 | 당일 완료한 퀘스트 수 | `dailyLogs` 기반 |
| 의지력 💪 | 도파민 내성에 따른 스탯 | `settings.statWillpower` |
| 집중력 🎯 | 도파민 내성에 따른 스탯 | `settings.statFocus` |

### 연속 기록 위험 경고

마지막 활동일이 어제이고 오늘 아직 퀘스트를 완료하지 않았으면 경고 배너 표시.

---

## 3. 퀘스트 탭

### 3-1. DDay 카드

퇴사 목표일까지의 카운트다운.

```
사용자 액션:
  ├─ D-Day 숫자 확인 (퇴사일까지 남은 일수)
  ├─ 진행률 바 확인 (1년 전 기준 시간 경과율)
  ├─ 퀘스트 페이스 비교 (기대 완료율 vs 실제 완료율)
  └─ "날짜 수정" → updateSettings({ resignationDate })
```

### 3-2. 오늘의 퀘스트

미완료 퀘스트 중 우선순위가 높은 3개를 자동 추천한다.

**정렬 기준:**
1. 마감일이 있는 퀘스트 우선
2. 마감일 오름차순
3. 진행률 높은 순

```
사용자 액션:
  └─ ⚔️ 완료 버튼 클릭 → completeQuest(id)
       ├─ XP 획득 팝업
       ├─ 레벨업 시 배너 애니메이션
       ├─ 스트릭 갱신
       └─ HeroStatus 자동 갱신
```

### 3-3. 퀘스트 보드

전체 퀘스트의 CRUD 관리.

#### 퀘스트 추가 플로우

```
"+ 새 퀘스트" 클릭
  ├─ 카테고리 선택 (블로그 / YouTube / 블록체인 / Ethereum)
  ├─ 제목·설명 입력
  ├─ 난이도 선택
  │    ├─ Easy   → 50 XP
  │    ├─ Normal → 100 XP
  │    ├─ Hard   → 200 XP
  │    └─ Epic   → 500 XP
  ├─ 마감일 설정 (선택)
  └─ addQuest() 호출
```

#### 퀘스트 관리 플로우

```
퀘스트 카드
  ├─ 진행률 슬라이더 조절 → updateQuest({ progress })
  ├─ ⚔️ 완료 버튼 → completeQuest(id)
  │    ├─ 퀘스트 완료 마킹 (completed=true, progress=100)
  │    ├─ XP 부여 (난이도별)
  │    ├─ 레벨 재계산 (누적 XP 기반)
  │    ├─ 스트릭 업데이트 (연속일 판정)
  │    ├─ 도파민 내성 감소 (Easy -2, Normal -3, Hard -4, Epic -5)
  │    ├─ daily_log upsert
  │    └─ sync dirty 마킹
  ├─ 마일스톤 관리
  │    ├─ "+ 마일스톤" → addMilestone()
  │    ├─ 체크박스 토글 → updateMilestone({ completed })
  │    └─ 삭제 → deleteMilestone(id)
  ├─ 편집 → updateQuest()
  └─ 삭제 → deleteQuest(id) (CASCADE로 마일스톤도 삭제)

완료된 퀘스트
  ├─ CLEAR 스탬프 표시
  └─ 클릭 시 되돌리기 가능 → updateQuest({ completed: false })
```

#### 퀘스트 완료 시 내부 처리 (completeQuest)

```
트랜잭션 시작
  1. quests 테이블: completed=1, progress=100, completed_at=today
  2. XP 부여: quest.xp (또는 난이도 기본값)
  3. 레벨 계산: 누적 XP 기반 (레벨 N에 필요한 총 XP = Σ(1~N) × 150)
  4. 스트릭 판정:
     ├─ 첫 활동 → streak = 1
     ├─ 오늘 이미 활동 → 변경 없음
     ├─ 어제 활동 → streak += 1
     └─ 그 외 → streak = 1 (리셋)
  5. 내성 감소: QUEST_TOLERANCE_REDUCTION[difficulty]
  6. 스탯 재계산: getToleranceState(tolerance) → willpower, focus 업데이트
  7. daily_logs upsert: quests_completed++, xp_earned += xpEarned
  8. sync_meta dirty 마킹
트랜잭션 종료
```

### 3-4. 런웨이 트래커

퇴사 후 생존 가능 기간을 시각화한다.

```
표시 정보:
  ├─ 퇴사일부터 runwayMonths 개월간 타임라인
  ├─ 현재 소진율 (경과 시간 / 전체 런웨이)
  ├─ 소진율 70% 이상 → ⚠️ 경고
  └─ 소진율 90% 이상 → 🚨 긴급 알림

사용자 액션:
  └─ 런웨이 기간 변경 → updateSettings({ runwayMonths })
```

---

## 4. 도파민 랩 탭

### 4-1. 내성 게이지 (ToleranceGauge)

도파민 내성 수치를 5단계로 시각화한다.

| 범위 | 상태 | 의지력 | 집중력 | XP 배율 |
|------|------|--------|--------|---------|
| 0~20 | 각성 상태 | +3 | +3 | 1.0x |
| 21~40 | 맑은 정신 | +2 | +2 | 1.0x |
| 41~60 | 보통 | 0 | 0 | 1.0x |
| 61~80 | 흐릿한 정신 | -1 | -1 | 1.0x |
| 81~100 | 도파민 과부하 | -2 | -2 | 0.8x |

**내성 변동 요인:**
- 도파민 사용 시간 → 내성 증가 (`duration_min × tolerance_rate`)
- 퀘스트 완료 → 내성 감소 (난이도별 -2~-5)
- 일일 마감 시 도파민 미사용 → 내성 -3
- 금욕 성공 → 내성 -2 (성공 건당)

### 4-2. 도파민 사용 추적

카테고리별 도파민 사용 시간을 실시간 기록한다.

**기본 카테고리 (프리셋):**

| 카테고리 | 아이콘 | 내성 증가율 (분당) |
|----------|--------|-------------------|
| SNS | 📱 | 0.15 |
| 영상 | 📺 | 0.20 |
| 게임 | 🎮 | 0.25 |
| 쇼츠/릴스 | 📳 | 0.30 |
| 쇼핑 | 🛒 | 0.15 |
| 음주/야식 | 🍺 | 0.20 |

#### 사용 기록 플로우

```
카테고리 선택 → "시작" 클릭
  └─ startDopamineLog(categoryId)
       ├─ dopamine_logs에 시작 시간 기록
       └─ 해당 카테고리의 활성 금욕 타이머 해제 (broken_at 설정)

기록 중 상태 (빨간 펄스 표시)
  └─ 실시간 경과 시간 표시

"중단" 클릭
  └─ stopDopamineLog(logId)
       ├─ 종료 시간 기록
       ├─ duration_min 계산
       ├─ tolerance_gain = duration_min × tolerance_rate
       ├─ settings.dopamine_tolerance += tolerance_gain
       └─ recalcStats() → 의지력/집중력 재계산
```

### 4-3. 금욕 타이머 (AbstinenceTimer)

카테고리별로 하루 동안 도파민 사용을 자제하는 타이머.

#### 금욕 타이머 플로우

```
카테고리 선택 → "금욕 시작"
  └─ startAbstinenceTimer(categoryId)
       ├─ 동일 카테고리+날짜에 기존 타이머 → 기존 ID 반환 (중복 방지)
       └─ 없으면 새 타이머 생성

타이머 진행 중
  ├─ 실시간 초 단위 카운트업 (HH:MM:SS)
  └─ 상태: 🟢 진행중

도파민 사용 시작 시
  └─ startDopamineLog() 내부에서 자동으로 타이머 해제
       └─ 상태: 🔴 실패 (broken_at 설정)

하루 마감 시
  └─ finalizeDay() 내부에서 미해제 타이머 → 성공 처리
       └─ 상태: ✅ 성공
```

### 4-4. 일일 리포트 (DopamineReport)

당일의 도파민 사용 현황을 요약한다.

```
표시 정보:
  ├─ 총 사용 시간 (분)
  ├─ 내성 변화 (tolerance_start → tolerance_end)
  ├─ 금욕 성공률 (성공 / 전체 타이머)
  └─ 카테고리별 사용량 바 차트
```

### 4-5. 하루 마감 (finalizeDay)

하루의 도파민 활동을 확정하는 트랜잭션.

```
"하루 마감" 버튼 클릭 → finalizeDay(date)
  트랜잭션 시작
    1. 미해제 금욕 타이머 → is_success = 1 (성공 처리)
    2. 타이머 통계 집계 (전체 수, 성공 수)
    3. 내성 변화 계산:
       ├─ 도파민 로그 0건 → -3 (사용하지 않은 날)
       └─ 금욕 성공 건당 → -2
    4. 금욕 스트릭 판정:
       ├─ 전체 타이머 = 전체 성공 → streak += 1
       └─ 하나라도 실패 → streak = 0
    5. dopamine_daily 테이블 upsert (일일 기록)
    6. settings.abstinence_streak 업데이트
    7. recalcStats() → 최종 스탯 반영
  트랜잭션 종료
```

---

## 5. 클라우드 동기화

Offline-First 아키텍처로 동작한다.

```
로컬 변경 발생
  └─ markDirty(tableName, localId) → sync_meta에 dirty 마킹

동기화 주기 (30초)
  ├─ Push: dirty 레코드 → Supabase upsert
  └─ Pull: Supabase에서 updated_at 기준 변경분 → 로컬 upsert (Last-Write-Wins)
```

### 동기화 대상 테이블

| 테이블 | 동기화 | 충돌 해결 |
|--------|--------|-----------|
| settings | ✅ | Last-Write-Wins |
| quests | ✅ | Last-Write-Wins |
| milestones | ✅ | Last-Write-Wins (부모 퀘스트 동기화 필요) |
| daily_logs | ✅ | Last-Write-Wins |
| dopamine_* | ❌ | 로컬 전용 (향후 확장 가능) |

---

## 6. 데이터 모델 관계도

```
settings (1행)
  ├─ playerName, level, totalXp
  ├─ currentStreak, longestStreak, lastActiveDate
  ├─ resignationDate, runwayMonths
  └─ dopamineTolerance, statWillpower, statFocus, abstinenceStreak

quests (N행)
  ├─ category, title, description, difficulty, xp
  ├─ completed, progress, completedAt
  └─ milestones (N행, CASCADE 삭제)
       ├─ title, completed, sortOrder
       └─ FK: quest_id → quests.id

daily_logs (날짜별 1행)
  ├─ questsCompleted, xpEarned
  └─ PK: date

dopamine_categories (N행)
  ├─ name, icon, toleranceRate, isPreset
  └─ dopamine_logs (N행)
  │    ├─ startedAt, endedAt, durationMin, toleranceGain
  │    └─ FK: category_id → dopamine_categories.id
  └─ abstinence_timers (N행)
       ├─ startedAt, brokenAt, isSuccess
       └─ FK: category_id → dopamine_categories.id

dopamine_daily (날짜별 1행)
  ├─ toleranceStart, toleranceEnd, totalUsageMin
  └─ abstinenceSuccess, abstinenceTotal

sync_meta (테이블×행 별 1행)
  ├─ table_name, local_id, remote_id
  └─ isDirty, isDeleted, lastSyncedAt
```

---

## 7. IPC API 목록

### Settings
| 채널 | 설명 |
|------|------|
| `db:getSettings` | 설정 전체 조회 |
| `db:updateSettings` | 설정 부분 업데이트 |

### Quests
| 채널 | 설명 |
|------|------|
| `db:getQuests` | 퀘스트 전체 조회 (sort_order 순) |
| `db:addQuest` | 퀘스트 추가 |
| `db:updateQuest` | 퀘스트 수정 |
| `db:deleteQuest` | 퀘스트 삭제 (마일스톤 CASCADE) |
| `db:completeQuest` | 퀘스트 완료 (XP/레벨/스트릭/내성 처리) |

### Daily Logs
| 채널 | 설명 |
|------|------|
| `db:getDailyLogs` | 최근 30일 일일 로그 |
| `db:getTodayQuests` | 오늘의 퀘스트 (상위 3개) |

### Milestones
| 채널 | 설명 |
|------|------|
| `db:getMilestones` | 특정 퀘스트의 마일스톤 조회 |
| `db:addMilestone` | 마일스톤 추가 |
| `db:updateMilestone` | 마일스톤 수정 |
| `db:deleteMilestone` | 마일스톤 삭제 |

### Dopamine
| 채널 | 설명 |
|------|------|
| `dopamine:getCategories` | 활성 카테고리 목록 |
| `dopamine:addCategory` | 카테고리 추가 |
| `dopamine:updateCategory` | 카테고리 수정 |
| `dopamine:deleteCategory` | 카테고리 삭제 (프리셋 제외) |
| `dopamine:startLog` | 사용 기록 시작 |
| `dopamine:stopLog` | 사용 기록 중단 |
| `dopamine:getActiveLog` | 진행 중인 로그 조회 |
| `dopamine:getLogsForDate` | 특정 날짜 로그 조회 |
| `dopamine:startAbstinence` | 금욕 타이머 시작 |
| `dopamine:getAbstinenceTimers` | 특정 날짜 타이머 조회 |
| `dopamine:finalizeDay` | 하루 마감 |
| `dopamine:getDaily` | 일일 도파민 요약 |
| `dopamine:getDailyRange` | N일치 도파민 데이터 |

### Auth & Sync
| 채널 | 설명 |
|------|------|
| `auth:signUp` | 회원가입 |
| `auth:signIn` | 로그인 |
| `auth:signInWithOAuth` | OAuth 로그인 |
| `auth:signOut` | 로그아웃 |
| `auth:getSession` | 세션 조회 |
| `auth:getUser` | 유저 조회 |
| `auth:isSupabaseConfigured` | Supabase 설정 여부 |
| `auth:initSupabase` | Supabase 초기화 |
| `sync:start` | 동기화 시작 |
| `sync:stop` | 동기화 중지 |
| `sync:now` | 즉시 동기화 |
| `sync:status` | 동기화 상태 조회 |
