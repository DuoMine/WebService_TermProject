-- backend/seed/seed.sql
-- FK-safe seed (id 계산 금지, 항상 SELECT 기반)

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE task_tags;
TRUNCATE TABLE comments;
TRUNCATE TABLE tasks;
TRUNCATE TABLE projects;
TRUNCATE TABLE workspace_members;
TRUNCATE TABLE tags;
TRUNCATE TABLE workspaces;
TRUNCATE TABLE user_providers;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- 1) USERS (총 30명)
-- =====================================================
INSERT INTO users (email, password_hash, name, role, status)
VALUES
  ('admin@example.com', NULL, 'admin', 'ADMIN', 'ACTIVE'),
  ('user1@example.com', NULL, 'user1', 'USER', 'ACTIVE');

INSERT INTO users (email, password_hash, name, role, status)
SELECT
  CONCAT('user', n, '@example.com'),
  NULL,
  CONCAT('user', n),
  'USER',
  'ACTIVE'
FROM (
  SELECT a.d + b.d * 10 AS n
  FROM (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
  CROSS JOIN
       (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b
) t
WHERE n BETWEEN 2 AND 29;

-- =====================================================
-- 2) USER_PROVIDERS (FK-safe)
-- =====================================================
INSERT INTO user_providers (user_id, provider, provider_uid)
SELECT id, 'FIREBASE', 'firebase_admin_uid'
FROM users
WHERE email = 'admin@example.com';

INSERT INTO user_providers (user_id, provider, provider_uid)
SELECT
  u.id,
  IF(u.id % 2 = 0, 'FIREBASE', 'KAKAO'),
  CONCAT(IF(u.id % 2 = 0, 'firebase_uid_', 'kakao_uid_'), u.id)
FROM users u
WHERE u.role = 'USER';

-- =====================================================
-- 3) WORKSPACES (10개)
-- =====================================================
INSERT INTO workspaces (name, owner_id)
SELECT
  CONCAT('Workspace ', n),
  u.id
FROM (
  SELECT a.d + 1 AS n
  FROM (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
) t
JOIN users u ON u.email = 'admin@example.com'
WHERE n BETWEEN 1 AND 10;

-- =====================================================
-- 4) WORKSPACE_MEMBERS
-- =====================================================
-- owner
INSERT INTO workspace_members (workspace_id, user_id)
SELECT w.id, u.id
FROM workspaces w
JOIN users u ON u.email = 'admin@example.com';

-- members (workspace당 6명)
INSERT INTO workspace_members (workspace_id, user_id)
SELECT
  w.id,
  u.id
FROM workspaces w
JOIN (
  SELECT id FROM users WHERE role = 'USER' ORDER BY id LIMIT 60
) u
ON 1 = 1
LIMIT 60;

-- =====================================================
-- 5) PROJECTS (workspace당 3개)
-- =====================================================
INSERT INTO projects (workspace_id, name, description, status, created_by)
SELECT
  w.id,
  CONCAT('Project ', w.id, '-', p.n),
  'seed project',
  'ACTIVE',
  w.owner_id
FROM workspaces w
CROSS JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3) p;

-- =====================================================
-- 6) TASKS (project당 4개)
-- =====================================================
INSERT INTO tasks (
  project_id, title, description, status, priority, due_at, created_by, assignee_id
)
SELECT
  p.id,
  CONCAT('Task ', p.id, '-', k.n),
  'seed task',
  CASE k.n % 3 WHEN 0 THEN 'DONE' WHEN 1 THEN 'TODO' ELSE 'DOING' END,
  CASE k.n % 3 WHEN 0 THEN 'HIGH' WHEN 1 THEN 'LOW' ELSE 'MEDIUM' END,
  DATE_ADD(CURDATE(), INTERVAL (p.id + k.n) DAY),
  w.owner_id,
  u.id
FROM projects p
JOIN workspaces w ON w.id = p.workspace_id
CROSS JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) k
JOIN users u ON u.role = 'USER'
LIMIT 120;

-- =====================================================
-- 7) COMMENTS (200개)
-- =====================================================
INSERT INTO comments (task_id, user_id, content)
SELECT
  ((n - 1) % 120) + 1        AS task_id,
  ((n - 1) % 29) + 2         AS user_id, -- user1 제외, user2~30
  CONCAT('comment #', n)     AS body
FROM (
  SELECT a.d + b.d*10 + c.d*100 + 1 AS n
  FROM (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
  CROSS JOIN
       (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b
  CROSS JOIN
       (SELECT 0 d UNION ALL SELECT 1 UNION ALL SELECT 2) c
) t
WHERE n BETWEEN 1 AND 200;

-- =====================================================
-- 8) TAGS (workspace당 6개)
-- =====================================================
INSERT INTO tags (workspace_id, name)
SELECT
  w.id,
  CONCAT('tag-', w.id, '-', t.n)
FROM workspaces w
CROSS JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) t;

-- =====================================================
-- 9) TASK_TAGS (200개)
-- =====================================================
INSERT INTO task_tags (task_id, tag_id)
SELECT
  t.id,
  tg.id
FROM tasks t
JOIN tags tg ON (t.id % tg.id) >= 0
LIMIT 200;

-- =====================================================
-- RESULT CHECK
-- =====================================================
SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM user_providers) AS user_providers,
  (SELECT COUNT(*) FROM workspaces) AS workspaces,
  (SELECT COUNT(*) FROM workspace_members) AS workspace_members,
  (SELECT COUNT(*) FROM projects) AS projects,
  (SELECT COUNT(*) FROM tasks) AS tasks,
  (SELECT COUNT(*) FROM comments) AS comments,
  (SELECT COUNT(*) FROM tags) AS tags,
  (SELECT COUNT(*) FROM task_tags) AS task_tags;
