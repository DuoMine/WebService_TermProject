CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(120) UNIQUE NULL,
  password_hash VARCHAR(255) NULL,
  name VARCHAR(60) NOT NULL,
  role ENUM('USER','ADMIN') NOT NULL DEFAULT 'USER',
  status ENUM('ACTIVE','SUSPENDED','DELETED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS user_providers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  provider ENUM('GOOGLE','FIREBASE') NOT NULL,
  provider_uid VARCHAR(191) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_provider (provider, provider_uid),
  UNIQUE KEY uq_user_provider (user_id, provider),
  CONSTRAINT fk_user_providers_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_refresh_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_token_hash (token_hash),
  INDEX idx_user_tokens_user (user_id),
  INDEX idx_user_tokens_expires (expires_at),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS workspaces (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(255) NULL,
  owner_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_workspaces_owner (owner_id),
  CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  workspace_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  member_role ENUM('OWNER','MEMBER') NOT NULL DEFAULT 'MEMBER',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workspace_user (workspace_id, user_id),
  INDEX idx_ws_members_user (user_id),
  CONSTRAINT fk_ws_members_ws FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  CONSTRAINT fk_ws_members_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS projects (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  workspace_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  status ENUM('ACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_projects_ws (workspace_id),
  INDEX idx_projects_status (status),
  CONSTRAINT fk_projects_ws FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  CONSTRAINT fk_projects_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NULL,
  status ENUM('TODO','DOING','DONE') NOT NULL DEFAULT 'TODO',
  priority ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'MEDIUM',
  due_at DATETIME NULL,
  created_by BIGINT NOT NULL,
  assignee_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_tasks_project (project_id),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_assignee (assignee_id),
  INDEX idx_tasks_due (due_at),
  CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_tasks_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  task_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  content VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_comments_task (task_id),
  CONSTRAINT fk_comments_task FOREIGN KEY (task_id) REFERENCES tasks(id),
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS tags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  workspace_id BIGINT NOT NULL,
  name VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tag_ws_name (workspace_id, name),
  INDEX idx_tags_ws (workspace_id),
  CONSTRAINT fk_tags_ws FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

CREATE TABLE IF NOT EXISTS task_tags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  task_id BIGINT NOT NULL,
  tag_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_task_tag (task_id, tag_id),
  INDEX idx_task_tags_tag (tag_id),
  CONSTRAINT fk_task_tags_task FOREIGN KEY (task_id) REFERENCES tasks(id),
  CONSTRAINT fk_task_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id)
);
