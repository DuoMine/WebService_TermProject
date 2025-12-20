// src/models/index.js
import { sequelize } from "../config/db.js";

import { defineUser } from "./User.js";
import { defineUserProvider } from "./UserProvider.js";
import { defineUserRefreshToken } from "./UserRefreshToken.js";
import { defineWorkspace } from "./Workspace.js";
import { defineWorkspaceMember } from "./WorkspaceMember.js";
import { defineProject } from "./Project.js";
import { defineTask } from "./Task.js";
import { defineComment } from "./Comment.js";
import { defineTag } from "./Tag.js";
import { defineTaskTag } from "./TaskTag.js";

export const models = {
  User: defineUser(sequelize),
  UserProvider: defineUserProvider(sequelize),
  UserRefreshToken: defineUserRefreshToken(sequelize),

  Workspace: defineWorkspace(sequelize),
  WorkspaceMember: defineWorkspaceMember(sequelize),

  Project: defineProject(sequelize),
  Task: defineTask(sequelize),
  Comment: defineComment(sequelize),

  Tag: defineTag(sequelize),
  TaskTag: defineTaskTag(sequelize),
};

// --------------------
// Associations
// --------------------
const {
  User,
  UserProvider,
  UserRefreshToken,
  Workspace,
  WorkspaceMember,
  Project,
  Task,
  Comment,
  Tag,
  TaskTag,
} = models;

// User - Provider / RefreshToken
User.hasMany(UserProvider, { foreignKey: "user_id", as: "providers" });
UserProvider.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasMany(UserRefreshToken, { foreignKey: "user_id", as: "refreshTokens" });
UserRefreshToken.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Workspace - Members
Workspace.belongsTo(User, { foreignKey: "owner_id", as: "owner" });
User.hasMany(Workspace, { foreignKey: "owner_id", as: "ownedWorkspaces" });

Workspace.hasMany(WorkspaceMember, { foreignKey: "workspace_id", as: "members" });
WorkspaceMember.belongsTo(Workspace, { foreignKey: "workspace_id", as: "workspace" });

User.hasMany(WorkspaceMember, { foreignKey: "user_id", as: "workspaceMemberships" });
WorkspaceMember.belongsTo(User, { foreignKey: "user_id", as: "user" });

// Workspace - Projects
Workspace.hasMany(Project, { foreignKey: "workspace_id", as: "projects" });
Project.belongsTo(Workspace, { foreignKey: "workspace_id", as: "workspace" });

Project.belongsTo(User, { foreignKey: "created_by", as: "creator" });

// Project - Tasks
Project.hasMany(Task, { foreignKey: "project_id", as: "tasks" });
Task.belongsTo(Project, { foreignKey: "project_id", as: "project" });

Task.belongsTo(User, { foreignKey: "created_by", as: "creator" });
Task.belongsTo(User, { foreignKey: "assignee_id", as: "assignee" });

// Task - Comments
Task.hasMany(Comment, { foreignKey: "task_id", as: "comments" });
Comment.belongsTo(Task, { foreignKey: "task_id", as: "task" });

Comment.belongsTo(User, { foreignKey: "user_id", as: "author" });

// Workspace - Tags
Workspace.hasMany(Tag, { foreignKey: "workspace_id", as: "tags" });
Tag.belongsTo(Workspace, { foreignKey: "workspace_id", as: "workspace" });

// Task - Tag (N:M)
Task.belongsToMany(Tag, {
  through: TaskTag,
  foreignKey: "task_id",
  otherKey: "tag_id",
  as: "tags",
});
Tag.belongsToMany(Task, {
  through: TaskTag,
  foreignKey: "tag_id",
  otherKey: "task_id",
  as: "tasks",
});

// TaskTag -> Tag / TaskTag -> Task (include 지원)
TaskTag.belongsTo(Tag, { foreignKey: "tag_id", as: "tag" });
Tag.hasMany(TaskTag, { foreignKey: "tag_id", as: "taskTags" });

TaskTag.belongsTo(Task, { foreignKey: "task_id", as: "task" });
Task.hasMany(TaskTag, { foreignKey: "task_id", as: "taskTags" });


export { sequelize };
