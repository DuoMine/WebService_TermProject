# Database Schema — MySQL

## 1) 개요
본 프로젝트는 MySQL을 주 데이터베이스로 사용한다.  
관계형 무결성과 검색 성능을 고려한 스키마를 설계하였다.

---

## 2) 주요 테이블

### users
| 컬럼 | 타입 | 설명 |
|----|----|----|
| id | BIGINT | PK |
| email | VARCHAR | UNIQUE |
| password | VARCHAR | 해시된 비밀번호 |
| role | ENUM | USER / ADMIN |
| status | ENUM | ACTIVE / DELETED |
| created_at | DATETIME | 생성일 |
| updated_at | DATETIME | 수정일 |

---

### workspaces
| 컬럼 | 타입 | 설명 |
|----|----|----|
| id | BIGINT | PK |
| name | VARCHAR | 워크스페이스 이름 |
| owner_id | BIGINT | 생성자 |
| created_at | DATETIME | 생성일 |

---

### workspace_members
| 컬럼 | 타입 | 설명 |
|----|----|----|
| id | BIGINT | PK |
| workspace_id | BIGINT | FK |
| user_id | BIGINT | FK |
| role | ENUM | OWNER / MEMBER |

---

### projects
| 컬럼 | 타입 | 설명 |
|----|----|----|
| id | BIGINT | PK |
| workspace_id | BIGINT | FK |
| name | VARCHAR | 프로젝트 이름 |
| status | ENUM | ACTIVE / ARCHIVED |

---

### tasks
| 컬럼 | 타입 | 설명 |
|----|----|----|
| id | BIGINT | PK |
| project_id | BIGINT | FK |
| title | VARCHAR | 태스크 제목 |
| status | ENUM | TODO / IN_PROGRESS / DONE |
| priority | ENUM | LOW / MEDIUM / HIGH |
| due_date | DATE | 마감일 |

---

### comments
| 컬럼 | 타입 | 설명 |
|----|----|----|
| id | BIGINT | PK |
| task_id | BIGINT | FK |
| user_id | BIGINT | FK |
| content | TEXT | 댓글 내용 |

---

### tags
| 컬럼 | 타입 | 설명 |
|----|----|----|
| id | BIGINT | PK |
| workspace_id | BIGINT | FK |
| name | VARCHAR | 태그 이름 |

---

### task_tags
| 컬럼 | 타입 | 설명 |
|----|----|----|
| id | BIGINT | PK |
| task_id | BIGINT | FK |
| tag_id | BIGINT | FK |

---

## 3) 인덱스 설계
- users.email (UNIQUE)
- workspace_members (workspace_id, user_id)
- tasks.project_id
- tasks.status
- tags (workspace_id, name)

---

## 4) 무결성 정책
- 주요 리소스는 Soft Delete 적용
- 연결 테이블(task_tags, workspace_members)은 Cascade Delete
- FK 기반 참조 무결성 유지
