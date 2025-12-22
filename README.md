# WebService_TermProject
1. 프로젝트 개요

본 프로젝트는 JWT 인증 기반 협업 관리 API 서버로,
워크스페이스를 중심으로 프로젝트·태스크·코멘트·태그를 관리할 수 있는 시스템이다.

과제 1에서 설계한 DB 스키마와 API 설계를 실제 서비스로 구현

Express + MySQL + Redis + Docker Compose 기반

워크스페이스 멤버십 기반 인가(RBAC) 구현

Postman Runner로 전체 시나리오 자동 테스트 가능

2. 기술 스택
구분	기술
Backend	Node.js, Express
ORM	Sequelize
Database	MySQL
Cache / Token Store	Redis
Auth	JWT (Access / Refresh), Firebase Auth, Kakao Login
documentation swagger
Infra	Docker, Docker Compose
Test	Postman / jest

3. 실행 방법
3-1. 환경 변수

.env.example 참고하여 .env 생성

3-2. Docker 실행
docker compose up -d


API Base URL: http://localhost:3000

Health Check: GET /api/health

3-3. DB 초기화
docker compose exec mysql \
mysql -u root -prootpw term_project < backend/migrations/001_init.sql

4. 인증 & 인가 구조
인증 방식

JWT 기반 Access / Refresh Token

Refresh Token은 Redis에 저장

Access Token 만료 시 /api/auth/refresh

로그아웃 시 Refresh Token revoke

소셜 로그인

Firebase Auth (Google)

Kakao Login

인가 정책 (RBAC)

ROLE_USER

ROLE_ADMIN

워크스페이스 관련 API는 전부
requireAuth → requireWorkspaceMember 미들웨어를 통과해야 하며,
통과 시 req.workspace 컨텍스트가 주입된다.

5. 핵심 리소스

users

workspaces

projects

tasks

comments

tags

👉 6개 리소스 모두 CRUD 제공
👉 과제 요구사항(4개 이상) 충족

6. API 엔드포인트 요약 (총 41개)

auth.js → /api/auth

users.js → /api/users

workspaces.js → /api/workspaces

projects.js → /api/workspaces/:workspaceId/projects

tasks.js → /api/workspaces/:workspaceId/projects/:projectId/tasks

comments.js → /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments

tags.js → /api/workspaces/:workspaceId/tags

Auth (7)

POST /api/auth/signup

POST /api/auth/login

POST /api/auth/refresh

POST /api/auth/logout

POST /api/auth/social/firebase

GET /api/auth/social/kakao/start

GET /api/auth/social/kakao/callback

Users (7)

GET /api/users/me

PATCH /api/users/me

DELETE /api/users/me

GET /api/users

GET /api/users/:id

PATCH /api/users/:id

DELETE /api/users/:id

Workspaces (8)

POST /api/workspaces

GET /api/workspaces

GET /api/workspaces/:workspaceId

PATCH /api/workspaces/:workspaceId

DELETE /api/workspaces/:workspaceId

GET /api/workspaces/:workspaceId/members

POST /api/workspaces/:workspaceId/members

DELETE /api/workspaces/:workspaceId/members/:userId

Projects (5)

POST /api/workspaces/:workspaceId/projects

GET /api/workspaces/:workspaceId/projects

GET /api/workspaces/:workspaceId/projects/:projectId

PATCH /api/workspaces/:workspaceId/projects/:projectId

DELETE /api/workspaces/:workspaceId/projects/:projectId

Tasks (5)

POST /api/workspaces/:workspaceId/projects/:projectId/tasks

GET /api/workspaces/:workspaceId/projects/:projectId/tasks

GET /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId

PATCH /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId

DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId

Comments (4)

POST /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments

GET /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments

PATCH /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments/:commentId

DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments/:commentId

Tags (5)

GET /api/workspaces/:workspaceId/tags

POST /api/workspaces/:workspaceId/tags

DELETE /api/workspaces/:workspaceId/tags/:tagId

GET /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/tags

POST /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/tags

DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/tags/:tagId

✔ 30개 이상 조건 충족

7. 목록 조회 공통 규격

Pagination: page, limit

Sorting: sort, order

Filtering / Search: 태스크 상태, 키워드 등

8. 에러 처리 규격

모든 에러는 아래 형식으로 반환된다.

{
  "timestamp": "2025-12-22T00:13:55.188Z",
  "path": "/api/workspaces/4/tags",
  "status": 409,
  "code": "CONFLICT",
  "message": "tag already exists"
}

사용 HTTP Status Code

200, 201, 204

400, 401, 403, 404, 409, 422, 429

500, 503

(요구된 12종 중 핵심 다수 충족)

9. 테스트 (Postman)

Postman Collection(JSON) 제공

Environment 변수 사용 (BASE_URL, etc.)

Runner로 전체 시나리오 실행 가능

테스트 시나리오

회원가입 / 로그인

워크스페이스 생성

멤버 추가

프로젝트 → 태스크 → 코멘트 생성

태그 생성 및 태스크 연결

Negative Test (401 / 403 / 404 / 409)

정리 및 로그아웃

10. 보안 & 기타

비밀번호 bcrypt 해시

CORS 설정

Redis 기반 토큰 관리

요청 크기 제한

Health Check (GET /api/health, 인증 없음)

11. 한계 및 개선 방향

관리자 전용 API 분리 가능

Swagger(OpenAPI) 문서 고도화

테스트 코드(Jest) 추가

통계/집계 API 확장
