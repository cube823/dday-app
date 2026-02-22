# D-Day Tracker

퇴사를 준비하는 당신을 위한 올인원 트래커 웹 애플리케이션입니다.

## 주요 기능

### 🎯 D-Day 카운터
- 목표 퇴사일까지 남은 일수 표시
- 실시간 진행률 및 진행 상황 시각화
- 개월/주/퍼센트 단위 다중 뷰

### 📖 학습 로드맵
퇴사 전 준비해야 할 스킬 트래킹:
- 블로그 글쓰기/콘텐츠 제작
- YouTube 콘텐츠 제작
- 블록체인/Web3 개발
- Ethereum 생태계 활동

각 스킬별 기능:
- 완료 체크박스
- 진행률 슬라이더 (0-100%)
- 마일스톤/서브태스크 관리
- 카테고리 및 상세 설명

### 💰 런웨이 트래커
- 퇴사 후 생존 가능 기간 설정 및 추적
- 경과일 및 잔여일 실시간 계산
- 소진율 기반 경고 시스템
- 시각적 진행률 표시

## 기술 스택

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (다크모드 지원)
- **Backend**: Node.js + Express
- **Database**: JSON 파일 스토리지

## 설치 및 실행

### 1. 의존성 설치

```bash
cd dday-app
npm install
```

### 2. 개발 모드 실행

```bash
# 프론트엔드와 백엔드를 동시에 실행
npm run dev

# 또는 개별 실행:
npm run dev:frontend  # 프론트엔드만 (포트 5173)
npm run dev:backend   # 백엔드만 (포트 3000)
```

애플리케이션 접속:
- 프론트엔드: http://localhost:5173
- 백엔드 API: http://localhost:3000/api

### 3. 프로덕션 빌드 및 실행

```bash
# 프론트엔드 빌드
npm run build

# 프로덕션 서버 시작 (API와 정적 파일 모두 제공)
npm start
```

## 프로젝트 구조

```
dday-app/
├── server/              # 백엔드 서버
│   ├── index.js        # Express 서버 진입점
│   ├── database.js     # 데이터베이스 로직 (JSON 스토리지)
│   └── routes/
│       └── api.js      # API 라우트
├── src/                # 프론트엔드 소스
│   ├── api/
│   │   └── client.ts   # API 클라이언트 함수
│   ├── components/     # React 컴포넌트
│   │   ├── DDay.tsx    # D-Day 카운터
│   │   ├── LearningSteps.tsx  # 학습 로드맵
│   │   └── Runway.tsx  # 런웨이 트래커
│   ├── types/          # TypeScript 타입
│   ├── App.tsx         # 메인 앱 컴포넌트
│   └── main.tsx        # React 진입점
├── data/               # 데이터 저장소 (gitignored)
│   └── dday-data.json  # 애플리케이션 데이터
├── dist/               # 빌드된 프론트엔드 파일
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## API 엔드포인트

### Settings
- `GET /api/settings` - 설정 조회
- `PUT /api/settings` - 설정 업데이트

### Learning Steps
- `GET /api/learning-steps` - 모든 학습 단계 조회
- `POST /api/learning-steps` - 새 학습 단계 생성
- `PUT /api/learning-steps/:id` - 학습 단계 업데이트
- `DELETE /api/learning-steps/:id` - 학습 단계 삭제

### Milestones
- `GET /api/milestones/:stepId` - 특정 단계의 마일스톤 조회
- `POST /api/milestones` - 새 마일스톤 생성
- `PUT /api/milestones/:id` - 마일스톤 업데이트
- `DELETE /api/milestones/:id` - 마일스톤 삭제

## 환경 변수

루트 디렉토리에 `.env` 파일 생성 (`.env.example` 참고):

```env
VITE_API_URL=http://localhost:3000/api
PORT=3000
```

## 데이터 스키마

### settings
- `resignation_date`: string (목표 퇴사일)
- `runway_months`: number (런웨이 개월 수)
- `start_date`: string | null (실제 퇴사일)

### learning_steps
- `id`: number
- `category`: string (카테고리명)
- `title`: string (제목)
- `description`: string (설명)
- `completed`: number (0 또는 1)
- `progress`: number (0-100)
- `order`: number (정렬 순서)

### milestones
- `id`: number
- `step_id`: number (learning_steps FK)
- `title`: string (마일스톤명)
- `completed`: number (0 또는 1)
- `order`: number (정렬 순서)

## 개발 가이드

### 새 기능 추가

1. **타입 정의**: `src/types/index.ts`에 타입 추가
2. **데이터베이스**: `server/database.js`에 함수 추가
3. **API 라우트**: `server/routes/api.js`에 엔드포인트 추가
4. **API 클라이언트**: `src/api/client.ts`에 클라이언트 함수 추가
5. **UI 컴포넌트**: `src/components/`에 컴포넌트 구현

### 스타일링

Tailwind CSS 유틸리티 클래스 사용:
- `card`: 기본 카드 스타일
- `btn-primary`: 주요 버튼
- `btn-secondary`: 보조 버튼
- `input-field`: 입력 필드
- `progress-bar`: 진행률 바

## 라이선스

MIT

## 기여

이슈와 PR은 언제나 환영합니다!
