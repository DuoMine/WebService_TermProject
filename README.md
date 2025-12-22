# WebService Term Project (Ko) — Workspace/Project/Task API

## 1) 프로젝트 개요

### 문제 정의
팀/개인 작업을 워크스페이스 단위로 관리하려면 **구성원/권한**, **프로젝트/태스크 구조**,  
**검색·정렬·페이지네이션**, **일관된 에러 포맷**, **배포/헬스체크/문서화**가 한 세트로 필요합니다.  
본 프로젝트는 이를 충족하는 협업 관리 API 서버를 구현합니다.

### 주요 기능
- JWT 기반 인증 (Access / Refresh, Refresh Rotation, Logout Revoke)
- 소셜 로그인 2종
  - Firebase Auth (Google)
  - Kakao Login
- Role 기반 인가 (ROLE_USER / ROLE_ADMIN)
- Workspace / Project / Task / Comment / Tag CRUD
- 공통 목록 조회 규격 (페이지네이션 · 정렬 · 검색)
- Redis 활용 (Refresh Token 저장, Rate Limit)
- Swagger(OpenAPI) 자동 문서
- Postman Collection 제공
- Health Check API 제공
- Docker Compose 기반 배포(JCloud)

---

## 2) 실행 방법

### 환경 변수 설정
```bash
# .env 파일 설정
cp .env.example .env
```

### 로컬 실행 (Node.js)

```bash
# mysql 및 redis 기동

# 의존성 설치
npm install

# 마이그레이션 및 시드 데이터
npm run migrate && npm run seed

# 서버 실행
npm run start
```

### Docker 실행

```bash
# 애플리케이션/MySQL/Redis 기동
docker compose up -d --build

# 처음 실행 및 db를 seed로 초기화할 때만
# (운영 중 실행 시 seed 데이터만 남기고 사라짐)
docker compose exec app npm run migrate
docker compose exec app npm run seed

# 컨테이너 상태 확인
docker compose ps
docker compose logs -f app
```

---

## 3) 환경변수 설명 (.env.example)

| 변수명 | 설명 |
|------|------|
| PORT | API 서버 포트 |
| CORS_ORIGIN | 허용 Origin |
| DB_HOST | MySQL 호스트 |
| DB_PORT | MySQL 포트 |
| DB_NAME | 데이터베이스 이름 |
| DB_USER | DB 사용자 |
| DB_PASSWORD | DB 비밀번호 |
| REDIS_HOST | Redis 호스트 |
| REDIS_PORT | Redis 포트 |
| JWT_ACCESS_SECRET | Access Token 서명 키 |
| JWT_REFRESH_SECRET | Refresh Token 서명 키 |
| JWT_ACCESS_EXPIRES_IN | Access Token 만료 시간 |
| JWT_REFRESH_EXPIRES_IN | Refresh Token 만료 시간 |
| FIREBASE_PROJECT_ID | Firebase 프로젝트 ID |
| FIREBASE_CLIENT_EMAIL | Firebase 서비스 계정 |
| FIREBASE_PRIVATE_KEY | Firebase Private Key |
| KAKAO_CLIENT_ID | Kakao REST API Key |
| KAKAO_REDIRECT_URI | Kakao Callback URL |

> 실제 값이 들어간 `.env` 파일은 **절대 public GitHub repo에 커밋하지 않습니다.**

---

## 4) 배포 주소

- **Base URL**  
  http://<JCLOUD_IP>:<PORT>

- **Swagger URL**  
  http://<JCLOUD_IP>:<PORT>/swagger-ui

- **Health URL**  
  GET http://<JCLOUD_IP>:<PORT>/api/health

---

## 5) 인증 플로우 설명

### 일반 로그인
1. POST /api/auth/login
2. Access / Refresh Token 발급
3. Access 만료 시 POST /api/auth/refresh
4. POST /api/auth/logout → Refresh Token revoke

### Firebase(Google) 로그인
1. 클라이언트에서 Google 로그인
2. Firebase ID Token 발급
3. POST /api/auth/social/firebase
4. 서버에서 토큰 검증 후 JWT 발급

### Kakao 로그인
1. GET /api/auth/social/kakao/start
2. Kakao 인증
3. GET /api/auth/social/kakao/callback
4. 사용자 생성 또는 로그인 처리

---

## 6) 역할 / 권한표

| Role | 설명 |
|-----|-----|
| ROLE_USER | 일반 사용자 기능 |
| ROLE_ADMIN | 사용자 관리 및 관리자 API 접근 |

| API | Method | 권한 |
|-----|--------|------|
| /api/users | GET | ADMIN |
| /api/users/:id | PATCH | ADMIN |
| /api/users/:id | DELETE | ADMIN |
| /api/users/me | GET | USER / ADMIN |
| /api/workspaces/** | ALL | USER / ADMIN |

---

## 7) 예제 계정

- USER  
  user1@example.com / P@ssw0rd!

- ADMIN  
  admin@example.com / P@ssw0rd!  
  (관리자 전용 API 접근 가능)

---

## 8) DB 연결 정보 (테스트용)

- Host: localhost
- Port: 3306
- Database: term_project
- User: root
- Password: rootpw

```bash
mysql -h 127.0.0.1 -P 3306 -u root -prootpw term_project
```

---

## 9) 엔드포인트 요약표

(총 30개 이상, CRUD + 서브 리소스 포함)

- Auth: /api/auth/**
- Users: /api/users/**
- Workspaces: /api/workspaces/**
- Projects: /api/workspaces/:workspaceId/projects/**
- Tasks: /api/workspaces/:workspaceId/projects/:projectId/tasks/**
- Comments: /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments/**
- Tags: /api/workspaces/:workspaceId/tags/**

---

## 10) 공통 응답 포맷 및 응답 코드 정의

### 공통 응답 포맷

#### 성공 응답
```json
{
  "success": true,
  "data": { },
  "meta": {
    "page": 0,
    "size": 20,
    "totalElements": 153,
    "totalPages": 8
  }
}
```

- `data`: 실제 응답 데이터
- `meta`: (목록 조회 시) 페이지네이션 정보, 단건 조회 시 생략 가능

#### 실패 응답
```json
{
  "success": false,
  "timestamp": "2025-03-05T12:34:56Z",
  "path": "/api/posts/1",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "message": "요청 값이 올바르지 않습니다.",
  "details": {
    "title": "길이는 1~100자여야 합니다."
  }
}
```

| 필드명 | 설명 |
|------|------|
| success | 성공 여부 |
| timestamp | 에러 발생 시각 (ISO 8601) |
| path | 요청 경로 |
| status | HTTP 상태 코드 |
| code | 시스템 내부 응답 코드 |
| message | 사용자에게 전달할 메시지 |
| details | (선택) 필드별 상세 오류 정보 |

---

### HTTP 응답 코드 정의 (성공 + 실패)

| HTTP 코드 | 코드 | 설명 |
|----------|------|------|
| **200** | OK | 조회/수정 성공 |
| **201** | CREATED | 리소스 생성 성공 |
| **204** | NO_CONTENT | 삭제 성공 (응답 본문 없음) |
| **400** | BAD_REQUEST | 요청 형식이 올바르지 않음 |
| 400 | VALIDATION_FAILED | 입력 값 검증 실패 |
| 400 | INVALID_QUERY_PARAM | 잘못된 쿼리 파라미터 |
| **401** | UNAUTHORIZED | 인증 토큰 없음 또는 잘못된 토큰 |
| 401 | TOKEN_EXPIRED | 토큰 만료 |
| **403** | FORBIDDEN | 접근 권한 없음 |
| **404** | RESOURCE_NOT_FOUND | 리소스를 찾을 수 없음 |
| 404 | USER_NOT_FOUND | 사용자 ID 없음 |
| **409** | DUPLICATE_RESOURCE | 중복 데이터 존재 |
| 409 | STATE_CONFLICT | 리소스 상태 충돌 |
| **422** | UNPROCESSABLE_ENTITY | 논리적으로 처리 불가한 요청 |
| **429** | TOO_MANY_REQUESTS | 요청 한도 초과 (Rate Limit) |
| **500** | INTERNAL_SERVER_ERROR | 서버 내부 오류 |
| 500 | DATABASE_ERROR | 데이터베이스 처리 오류 |
| **503** | SERVICE_UNAVAILABLE | 외부 서비스 또는 인프라 장애 (DB/Redis 등) |

---

### 응답 처리 규칙

1. 모든 API는 성공/실패 여부를 `success` 필드로 명확히 구분한다.
2. 모든 실패 응답은 위 실패 응답 포맷을 따른다.
3. Validation 실패 시 필드별 오류를 `details` 객체로 포함한다.
4. Swagger 문서의 각 엔드포인트에는 최소 다음 응답을 명시한다.
   - 200 / 201 / 204
   - 400 / 401 / 403 / 404 / 409 / 422 / 429 
   - 500 / 503
5. Postman Collection에는 대표적인 성공/실패 케이스 검증 요청을 포함한다.
---

## 11) 성능 / 보안 고려사항
- bcrypt 기반 비밀번호 해시
- Redis 기반 Refresh Token 관리
- 전역 Rate Limit 적용
- DB 인덱스 적용 (검색/조인 컬럼)
- CORS 제한
- 민감 정보 .env 분리

---

## 12) 한계와 개선 계획
- 알림(Notification) 기능 추가
- 파일 업로드(S3) 연동
- 통계/대시보드 API 확장
- CI/CD 파이프라인 구축
