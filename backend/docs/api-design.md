# API Design — Workspace / Project / Task API

## 1) 개요
본 문서는 WebService Term Project의 API 설계를 설명한다.  
JWT 기반 인증을 중심으로 워크스페이스 단위 협업 기능을 제공하며,  
RESTful 원칙, 일관된 응답 포맷, 확장 가능한 구조를 목표로 한다.

---

## 2) 설계 원칙
- RESTful URL 설계 (명사 중심, 계층 구조)
- HTTP Method 의미 준수 (GET/POST/PATCH/DELETE)
- 상태 코드는 HTTP Status Code로 표현
- 모든 응답은 JSON 형식
- 성공/실패 응답 포맷 통일
- 인증/인가 로직은 Middleware로 분리

---

## 3) 인증/인가 설계

### 3-1. 인증 방식
- JWT 기반 인증
  - Access Token
  - Refresh Token (Rotation 적용)
- Refresh Token은 Redis에 저장
- Logout 시 Refresh Token revoke

### 3-2. 소셜 로그인
- Firebase Auth (Google)
- Kakao Login (Authorization Code Flow)

### 3-3. 인가 방식 (RBAC)
- ROLE_USER
- ROLE_ADMIN

관리자 전용 API 예시:
- GET /api/users
- PATCH /api/users/:id
- DELETE /api/users/:id

---

## 4) API 계층 구조

- /api/auth/**
- /api/users/**
- /api/workspaces/**
  - /projects/**
    - /tasks/**
      - /comments/**
  - /tags/**

---

## 5) 공통 목록 조회 규격

### 요청 파라미터
- page: 페이지 번호 (0부터 시작)
- size: 페이지 크기
- sort: 정렬 필드
- order: ASC | DESC
- keyword: 검색 키워드

### 응답 예시
```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "page": 0,
    "size": 20,
    "totalElements": 153,
    "totalPages": 8
  }
}
```

---

## 6) 공통 응답 포맷

### 성공 응답
```json
{
  "success": true,
  "data": { }
}
```

### 실패 응답
```json
{
  "success": false,
  "timestamp": "2025-03-05T12:34:56Z",
  "path": "/api/tasks/1",
  "status": 404,
  "code": "RESOURCE_NOT_FOUND",
  "message": "리소스를 찾을 수 없습니다."
}
```

---

## 7) 에러 처리 전략
- 모든 예외는 공통 에러 핸들러에서 처리
- 비즈니스 오류 → 4xx
- 시스템 오류 → 5xx
- DB/Redis 장애 → 503 SERVICE_UNAVAILABLE
