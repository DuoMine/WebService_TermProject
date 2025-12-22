// src/routes/tasks.js
import express from "express";
import { models } from "../models/index.js";
import { sendOk, sendError } from "../utils/http.js";

const router = express.Router({ mergeParams: true });

/**
 * 전제:
 * app.js에서 아래가 먼저 적용됨
 * app.use("/api/workspaces/:workspaceId", requireAuth, requireWorkspaceMember());
 *
 * => req.auth 존재
 * => req.workspace 존재 (deleted_at null까지 확인됨)
 */

const VALID_STATUS = ["TODO", "DOING", "DONE"];
const VALID_PRIORITY = ["LOW", "MEDIUM", "HIGH"];

async function loadProjectOr404(req, res) {
  const workspaceId = req.workspace.id;
  const projectId = Number(req.params.projectId);

  if (!projectId) {
    sendError(res, 400, "BAD_REQUEST", "invalid projectId");
    return null;
  }

  const project = await models.Project.findOne({
    where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
  });

  if (!project) {
    sendError(res, 404, "NOT_FOUND", "project not found");
    return null;
  }

  return project;
}

// GET /api/workspaces/:workspaceId/projects/:projectId/tasks
router.get("/", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;

  const projectId = Number(req.params.projectId);

  const tasks = await models.Task.findAll({
    where: { project_id: projectId, deleted_at: null },
    order: [["created_at", "DESC"]],
  });

  return sendOk(res, { tasks });
});

// POST /api/workspaces/:workspaceId/projects/:projectId/tasks
router.post("/", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;

  const projectId = Number(req.params.projectId);
  const userId = req.auth.userId;

  const { title, description, status, priority, dueAt, assigneeId } = req.body;
  if (!title) return sendError(res, 400, "BAD_REQUEST", "title required");

  if (status !== undefined && !VALID_STATUS.includes(status)) {
    return sendError(res, 400, "BAD_REQUEST", "invalid status");
  }
  if (priority !== undefined && !VALID_PRIORITY.includes(priority)) {
    return sendError(res, 400, "BAD_REQUEST", "invalid priority");
  }

  const task = await models.Task.create({
    project_id: projectId,
    title,
    description: description ?? null,
    status: status ?? "TODO",
    priority: priority ?? "MEDIUM",
    due_at: dueAt ?? null,
    created_by: userId,
    assignee_id: assigneeId ?? null,
  });

  return sendOk(res, { task }, 201);
});

// GET /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId
router.get("/:taskId", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;

  const projectId = Number(req.params.projectId);
  const taskId = Number(req.params.taskId);
  if (!taskId) return sendError(res, 400, "BAD_REQUEST", "invalid taskId");

  const task = await models.Task.findOne({
    where: { id: taskId, project_id: projectId, deleted_at: null },
  });
  if (!task) return sendError(res, 404, "NOT_FOUND", "task not found");

  return sendOk(res, { task });
});

// PATCH /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId
router.patch("/:taskId", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;

  const projectId = Number(req.params.projectId);
  const taskId = Number(req.params.taskId);
  if (!taskId) return sendError(res, 400, "BAD_REQUEST", "invalid taskId");

  const task = await models.Task.findOne({
    where: { id: taskId, project_id: projectId, deleted_at: null },
  });
  if (!task) return sendError(res, 404, "NOT_FOUND", "task not found");

  const { title, description, status, priority, dueAt, assigneeId } = req.body;

  if (status !== undefined && !VALID_STATUS.includes(status)) {
    return sendError(res, 400, "BAD_REQUEST", "invalid status");
  }
  if (priority !== undefined && !VALID_PRIORITY.includes(priority)) {
    return sendError(res, 400, "BAD_REQUEST", "invalid priority");
  }

  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (status !== undefined) task.status = status;
  if (priority !== undefined) task.priority = priority;
  if (dueAt !== undefined) task.due_at = dueAt;
  if (assigneeId !== undefined) task.assignee_id = assigneeId;

  await task.save();
  return sendOk(res, { task });
});

// DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId (soft delete)
router.delete("/:taskId", async (req, res) => {
  const project = await loadProjectOr404(req, res);
  if (!project) return;

  const projectId = Number(req.params.projectId);
  const taskId = Number(req.params.taskId);
  if (!taskId) return sendError(res, 400, "BAD_REQUEST", "invalid taskId");

  const task = await models.Task.findOne({
    where: { id: taskId, project_id: projectId, deleted_at: null },
  });
  if (!task) return sendError(res, 404, "NOT_FOUND", "task not found");

  task.deleted_at = new Date();
  await task.save();

  return sendOk(res);
});

export default router;
