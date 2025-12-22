# API Design (Term Project)

## 1. 프로젝트 개요
본 프로젝트는 JWT 인증 기반 협업 관리 API 서버로, 워크스페이스를 중심으로 프로젝트/태스크/코멘트/태그를 관리한다.  
기술 스택: Express + MySQL + Redis + Docker Compose, ORM: Sequelize. :contentReference[oaicite:1]{index=1}

---

## 2. 아키텍처 / 모듈 구성
- `src/app.js`
  - CORS, JSON body limit, cookie-parser
  - 전역 rate limit (Redis store)
  - 라우터 마운트: `/api/auth`, `/api/users`, `/api/workspaces`, 하위 리소스
  - 공통 에러핸들러
- `src/middlewares`
  - `requireAuth`: Access Token 검증, `req.auth` 설정
  - `requireWorkspaceMember`: 워크스페이스 멤버십 확인, `req.workspace` 컨텍스트 주입 :contentReference[oaicite:2]{index=2}
- `src/routes`
  - `auth.js`, `users.js`, `workspaces.js`, `projects.js`, `tasks.js`, `comments.js`, `tags.js`
- `src/models`
  - Sequelize 모델 + 연관관계 정의

---

## 3. 인증/인가 설계

### 3-1. 토큰 정책
- Access Token: JWT, 짧은 만료(예: 15m)
- Refresh Token: 장기 만료(예: 14d), **Redis에 저장**
- Refresh Rotation: refresh 시 새 refresh 발급 + 이전 refresh revoke
- Logout: refresh revoke + 쿠키 제거 :contentReference[oaicite:3]{index=3}

### 3-2. 쿠키/헤더
- Access: (권장) `Authorization: Bearer <token>` 또는 쿠키(프로젝트 구현에 맞춤)
- Refresh: HttpOnly cookie (예: `refresh_token`) 저장

### 3-3. RBAC
- Role 최소 2개: `ROLE_USER`, `ROLE_ADMIN` :contentReference[oaicite:4]{index=4}
- Admin 전용 예시(최소 3개 확보 권장)
  - `GET /api/users` (전체 사용자 조회)
  - `PATCH /api/users/:id` (사용자 역할/상태 변경)
  - `DELETE /api/users/:id` (사용자 비활성/삭제)

### 3-4. 워크스페이스 인가
- 워크스페이스 관련 API는 `requireAuth` → `requireWorkspaceMember`
- 통과 시 `req.workspace` 컨텍스트가 주입되고, 이후 하위 리소스 접근에 사용 :contentReference[oaicite:5]{index=5}

---

## 4. 소셜 로그인
- Firebase Auth (Google)
- Kakao Login (start/callback) :contentReference[oaicite:6]{index=6}

소셜 로그인 흐름(권장):
1) FE: Google 로그인 후 `idToken` 획득  
2) FE → BE: `POST /api/auth/social/firebase { idToken }`  
3) BE: Firebase Admin으로 검증 → 사용자 upsert → JWT 발급

Kakao 흐름:
1) `GET /api/auth/social/kakao/start` → 카카오 인증 페이지 리다이렉트  
2) `GET /api/auth/social/kakao/callback?code=...` → code 교환 후 사용자 upsert → JWT 발급

---

## 5. 목록 조회 공통 규격(페이지네이션/검색/정렬)
- Pagination: `page`, `limit` (또는 `size`) 기본값/최대값 명시
- Sort: `sort`, `order=ASC|DESC`
- Search/Filter: 최소 2개 이상
  - 예: tasks: `status`, `keyword`, `assigneeId`, `dateFrom/dateTo` 등 :contentReference[oaicite:7]{index=7}

응답 예시:
```json
{
  "content": [],
  "page": 0,
  "limit": 20,
  "totalElements": 153,
  "totalPages": 8,
  "sort": "createdAt,DESC"
}
```
- 에러 응답 통일 규격 : 모든 오류는 일관된 JSON 포맷으로 반환

응답 예시:
```json
{
  "timestamp": "2025-12-23T00:00:00Z",
  "path": "/api/workspaces/1",
  "status": 404,
  "code": "RESOURCE_NOT_FOUND",
  "message": "workspace not found",
  "details": { "workspaceId": 1 }
}
```

### 대표 에러 코드(최소 12종 이상 권장):

- 400: BAD_REQUEST, VALIDATION_FAILED, INVALID_QUERY_PARAM
- 401: UNAUTHORIZED, TOKEN_EXPIRED, TOKEN_INVALID
- 403: FORBIDDEN
- 404: RESOURCE_NOT_FOUND, USER_NOT_FOUND
- 409: DUPLICATE_RESOURCE, STATE_CONFLICT
- 422: UNPROCESSABLE_ENTITY
- 429: TOO_MANY_REQUESTS
- 500: INTERNAL_SERVER_ERROR, DATABASE_ERROR
- 503: SERVICE_UNAVAILABLE

---

## 7. 엔드포인트 요약 (41개)

(레포 README 기준) 
GitHub

- Auth (7)
```
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/social/firebase
GET /api/auth/social/kakao/start
GET /api/auth/social/kakao/callback
```

- Users (7)
```
GET /api/users/me
PATCH /api/users/me
DELETE /api/users/me
GET /api/users (admin)
GET /api/users/:id (admin)
PATCH /api/users/:id (admin)
DELETE /api/users/:id (admin)
```

- Workspaces (8)
```
POST /api/workspaces
GET /api/workspaces
GET /api/workspaces/:workspaceId
PATCH /api/workspaces/:workspaceId
DELETE /api/workspaces/:workspaceId
GET /api/workspaces/:workspaceId/members
POST /api/workspaces/:workspaceId/members
DELETE /api/workspaces/:workspaceId/members/:userId
```

- Projects (5)
```
POST /api/workspaces/:workspaceId/projects
GET /api/workspaces/:workspaceId/projects
GET /api/workspaces/:workspaceId/projects/:projectId
PATCH /api/workspaces/:workspaceId/projects/:projectId
DELETE /api/workspaces/:workspaceId/projects/:projectId
```

- Tasks (5)
```
POST /api/workspaces/:workspaceId/projects/:projectId/tasks
GET /api/workspaces/:workspaceId/projects/:projectId/tasks
GET /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId
PATCH /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId
DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId
```

- Comments (4)
```
POST /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments
GET /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments
PATCH /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments/:commentId
DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments/:commentId
```

- Tags (5)
```
GET /api/workspaces/:workspaceId/tags
POST /api/workspaces/:workspaceId/tags
DELETE /api/workspaces/:workspaceId/tags/:tagId
GET /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/tags
POST /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/tags
DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/tags/:tagId
```

---

## 8. Swagger 문서화 원칙

각 엔드포인트에 대해:

Request/Response 스키마 + 예시
최소 응답 예시: 400/401/403/404/422/500(+429,503 권장)
JWT 보안 스키마 적용 (Bearer 또는 Cookie)