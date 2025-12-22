# DB Schema (MySQL) - WebService Term Project

## 1. 개요
- DB: MySQL
- ORM: Sequelize
- 핵심 도메인: users, workspaces, projects, tasks, comments, tags
- 연관(Join) 테이블: workspace_members, task_tags
- 소셜 로그인/토큰: user_providers, user_refresh_tokens(또는 Redis 기반 refresh만 쓰면 테이블 생략 가능)

---

## 2. ERD (텍스트)
users (1) --- (N) user_providers
users (1) --- (N) user_refresh_tokens [선택]

users (N) --- (N) workspaces  via workspace_members
workspaces (1) --- (N) projects
projects (1) --- (N) tasks
tasks (1) --- (N) comments

workspaces (1) --- (N) tags
tasks (N) --- (N) tags via task_tags

---

## 3. 테이블 정의

### 3-1. users
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT | PK, AI | 사용자 ID |
| email | VARCHAR(191) | UNIQUE, NOT NULL | 이메일 |
| password_hash | VARCHAR(255) | NULL 가능 | 로컬 로그인용(소셜만이면 NULL) |
| name | VARCHAR(100) | NOT NULL | 표시 이름 |
| role | ENUM('USER','ADMIN') | NOT NULL | RBAC 역할 |
| status | ENUM('ACTIVE','DELETED','SUSPENDED') | NOT NULL | 계정 상태 |
| created_at | DATETIME | NOT NULL | 생성일 |
| updated_at | DATETIME | NOT NULL | 수정일 |

인덱스:
- uq_users_email(email)
- idx_users_role(role), idx_users_status(status)

---

### 3-2. user_providers
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT | PK, AI | |
| user_id | BIGINT | FK(users.id) | 사용자 |
| provider | ENUM('KAKAO','FIREBASE') | NOT NULL | 제공자 |
| provider_uid | VARCHAR(191) | NOT NULL | 제공자 UID |

제약/인덱스:
- uq_provider_uid(provider, provider_uid)
- uq_user_provider(user_id, provider)

---

### 3-3. workspaces
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT | PK, AI | |
| name | VARCHAR(100) | NOT NULL | 워크스페이스 이름 |
| owner_user_id | BIGINT | FK(users.id) | 소유자 |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

인덱스:
- idx_workspaces_owner(owner_user_id)

---

### 3-4. workspace_members
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT | PK, AI | |
| workspace_id | BIGINT | FK(workspaces.id) | |
| user_id | BIGINT | FK(users.id) | |
| member_role | ENUM('OWNER','MEMBER') | NOT NULL | 워크스페이스 내 역할 |
| created_at | DATETIME | NOT NULL | |

제약/인덱스:
- uq_workspace_user(workspace_id, user_id)
- idx_members_user(user_id)

---

### 3-5. projects
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT | PK, AI | |
| workspace_id | BIGINT | FK(workspaces.id) | 소속 워크스페이스 |
| name | VARCHAR(120) | NOT NULL | 프로젝트명 |
| description | TEXT | NULL | 설명 |
| status | ENUM('ACTIVE','ARCHIVED') | NOT NULL | 상태 |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

인덱스:
- idx_projects_workspace(workspace_id)
- idx_projects_status(status)

---

### 3-6. tasks
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT | PK, AI | |
| project_id | BIGINT | FK(projects.id) | |
| title | VARCHAR(200) | NOT NULL | 제목 |
| description | TEXT | NULL | 내용 |
| status | ENUM('TODO','IN_PROGRESS','DONE') | NOT NULL | 상태 |
| priority | ENUM('LOW','MEDIUM','HIGH') | NOT NULL | 우선순위 |
| due_date | DATE | NULL | 마감일 |
| created_by | BIGINT | FK(users.id) | 생성자 |
| assignee_id | BIGINT | FK(users.id) | 담당자 |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

인덱스(검색/정렬/필터용):
- idx_tasks_project(project_id)
- idx_tasks_status(status)
- idx_tasks_assignee(assignee_id)
- idx_tasks_due(due_date)
- (옵션) FULLTEXT(title, description) 또는 title LIKE 검색용 idx_tasks_title(title)

---

### 3-7. comments
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT | PK, AI | |
| task_id | BIGINT | FK(tasks.id) | |
| user_id | BIGINT | FK(users.id) | 작성자 |
| body | TEXT | NOT NULL | 내용 |
| created_at | DATETIME | NOT NULL | |
| updated_at | DATETIME | NOT NULL | |

인덱스:
- idx_comments_task(task_id)
- idx_comments_user(user_id)

---

### 3-8. tags
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT | PK, AI | |
| workspace_id | BIGINT | FK(workspaces.id) | 워크스페이스 범위 |
| name | VARCHAR(50) | NOT NULL | 태그명 |
| created_at | DATETIME | NOT NULL | |

제약/인덱스:
- uq_tag_name_in_workspace(workspace_id, name)

---

### 3-9. task_tags (N:M)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT | PK, AI | |
| task_id | BIGINT | FK(tasks.id) | |
| tag_id | BIGINT | FK(tags.id) | |

제약/인덱스:
- uq_task_tag(task_id, tag_id)
- idx_task_tags_tag(tag_id)

---

## 4. 삭제/무결성 정책
- users 삭제: 실제 삭제 대신 `status=DELETED` 권장(연관 데이터 보존)
- workspace/project/task 삭제: 요구사항에 따라 soft delete 또는 hard delete
- FK: 기본 RESTRICT, 필요 시 CASCADE는 범위 최소화(예: task_tags, workspace_members)

---

## 5. 시드 데이터 정책(200+)
- users: 30
- workspaces: 10
- workspace_members: 60~100
- projects: 30
- tasks: 120
- comments: 200
- tags: 60
- task_tags: 200+
총합 700+ 레코드로 검색/페이지네이션/통계 검증 가능
