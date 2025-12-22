// src/routes/comments.js
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
 * => req.workspace 존재
 */

async function loadProjectTaskOr404(req, res) {
  const workspaceId = req.workspace.id;
  const projectId = Number(req.params.projectId);
  const taskId = Number(req.params.taskId);

  if (!projectId) {
    sendError(res, 400, "BAD_REQUEST", "invalid projectId");
    return null;
  }
  if (!taskId) {
    sendError(res, 400, "BAD_REQUEST", "invalid taskId");
    return null;
  }

  const project = await models.Project.findOne({
    where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
  });
  if (!project) {
    sendError(res, 404, "NOT_FOUND", "project not found");
    return null;
  }

  const task = await models.Task.findOne({
    where: { id: taskId, project_id: projectId, deleted_at: null },
  });
  if (!task) {
    sendError(res, 404, "NOT_FOUND", "task not found");
    return null;
  }

  return { project, task };
}

// GET /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments
router.get("/", async (req, res) => {
  const ok = await loadProjectTaskOr404(req, res);
  if (!ok) return;

  const taskId = Number(req.params.taskId);

  const comments = await models.Comment.findAll({
    where: { task_id: taskId, deleted_at: null },
    order: [["created_at", "ASC"]],
  });

  return sendOk(res, { comments });
});

// POST /api/.../comments  body: { content }
router.post("/", async (req, res) => {
  const ok = await loadProjectTaskOr404(req, res);
  if (!ok) return;

  const taskId = Number(req.params.taskId);
  const userId = req.auth.userId;
  const { content } = req.body;

  if (!content) return sendError(res, 400, "BAD_REQUEST", "content required");

  const c = await models.Comment.create({
    task_id: taskId,
    user_id: userId,
    content,
  });

  return sendOk(res, { comment: c }, 201);
});

// PATCH /api/.../comments/:commentId
router.patch("/:commentId", async (req, res) => {
  const ok = await loadProjectTaskOr404(req, res);
  if (!ok) return;

  const taskId = Number(req.params.taskId);
  const commentId = Number(req.params.commentId);
  if (!commentId) return sendError(res, 400, "BAD_REQUEST", "invalid commentId");

  const { content } = req.body;

  const c = await models.Comment.findOne({
    where: { id: commentId, task_id: taskId, deleted_at: null },
  });
  if (!c) return sendError(res, 404, "NOT_FOUND", "comment not found");

  if (content !== undefined) c.content = content;
  await c.save();

  return sendOk(res, { comment: c });
});

// DELETE /api/.../comments/:commentId (soft delete)
router.delete("/:commentId", async (req, res) => {
  const ok = await loadProjectTaskOr404(req, res);
  if (!ok) return;

  const taskId = Number(req.params.taskId);
  const commentId = Number(req.params.commentId);
  if (!commentId) return sendError(res, 400, "BAD_REQUEST", "invalid commentId");

  const c = await models.Comment.findOne({
    where: { id: commentId, task_id: taskId, deleted_at: null },
  });
  if (!c) return sendError(res, 404, "NOT_FOUND", "comment not found");

  c.deleted_at = new Date();
  await c.save();

  return sendOk(res);
});

export default router;
