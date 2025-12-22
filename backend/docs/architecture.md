# Architecture — WebService Term Project

## 1) 개요
본 문서는 WebService Term Project의 전체 시스템 아키텍처를 설명한다.  
애플리케이션은 컨테이너 기반으로 배포되며, 확장성과 유지보수를 고려한 구조를 따른다.

---

## 2) 전체 구조

Client
 └─ API Server (Express)
     ├─ MySQL
     └─ Redis

---

## 3) 애플리케이션 레이어 구조

- Controller (Route)
  - HTTP 요청/응답 처리
- Service
  - 비즈니스 로직
- Model (ORM)
  - DB 접근 (Sequelize)
- Middleware
  - 인증/인가
  - 에러 처리
  - Rate Limit

---

## 4) 인증 흐름

1. Client → Login 요청
2. API Server → JWT 발급
3. Client → Authorization Header에 Access Token 포함
4. Access 만료 시 Refresh 요청
5. Redis 검증 후 재발급

---

## 5) Redis 활용
- Refresh Token 저장
- Token Rotation
- Rate Limiting Store

---

## 6) Docker 기반 배포

### 컨테이너 구성
- api: Node.js Express 서버
- mysql: MySQL Database
- redis: Redis Server

### 실행
```bash
docker compose up -d
```

---

## 7) 헬스체크
- GET /api/health
- DB, Redis 연결 상태 확인
- 서버 버전 및 빌드 시간 반환

---

## 8) 확장 고려사항
- API 서버 수평 확장
- Redis 분리 구성
- CI/CD 파이프라인 연계
