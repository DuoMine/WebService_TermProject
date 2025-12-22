// src/routes/tags.js
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

// 공통: project/task 스코프 확인
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

/**
 * =========================
 * Workspace Tags
 * =========================
 * 실제 경로:
 * - GET    /api/workspaces/:workspaceId/tags
 * - POST   /api/workspaces/:workspaceId/tags
 * - DELETE /api/workspaces/:workspaceId/tags/:tagId
 */

// GET /tags
router.get("/tags", async (req, res) => {
  const workspaceId = req.workspace.id;

  const tags = await models.Tag.findAll({
    where: { workspace_id: workspaceId },
    order: [["name", "ASC"]],
  });

  return sendOk(res, { tags });
});

// POST /tags  body: { name }
router.post("/tags", async (req, res) => {
  const workspaceId = req.workspace.id;
  const { name } = req.body;

  if (!name) return sendError(res, 400, "BAD_REQUEST", "name required");

  try {
    const tag = await models.Tag.create({ workspace_id: workspaceId, name });
    return sendOk(res, { tag }, 201);
  } catch (e) {
    // ✅ 진짜 원인 로깅 (마감 전까지는 꼭 켜둬)
    console.error("[POST /tags] create failed:", e?.name, e?.message, e?.original?.code, e?.original?.errno);

    // ✅ 유니크 충돌만 409
    if (e?.name === "SequelizeUniqueConstraintError") {
      return sendError(res, 409, "CONFLICT", "tag already exists");
    }

    // ✅ FK/validation 등은 400/500로 분리
    if (e?.name === "SequelizeForeignKeyConstraintError") {
      return sendError(res, 400, "BAD_REQUEST", "invalid workspace_id");
    }
    if (e?.name === "SequelizeValidationError") {
      return sendError(res, 400, "BAD_REQUEST", "invalid tag data");
    }

    return sendError(res, 500, "INTERNAL_ERROR", "failed to create tag");
  }
});

// DELETE /tags/:tagId
router.delete("/tags/:tagId", async (req, res) => {
  const workspaceId = req.workspace.id;
  const tagId = Number(req.params.tagId);

  if (!tagId) return sendError(res, 400, "BAD_REQUEST", "invalid tagId");

  const tag = await models.Tag.findOne({
    where: { id: tagId, workspace_id: workspaceId },
  });
  if (!tag) return sendError(res, 404, "NOT_FOUND", "tag not found");

  await tag.destroy();
  return sendOk(res);
});

/**
 * =========================
 * Task Tags (task_tags)
 * =========================
 * 실제 경로:
 * - GET    /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/tags
 * - POST   /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/tags
 * - DELETE /api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/tags/:tagId
 */

// GET /projects/:projectId/tasks/:taskId/tags
router.get("/projects/:projectId/tasks/:taskId/tags", async (req, res) => {
  const ok = await loadProjectTaskOr404(req, res);
  if (!ok) return;

  const taskId = Number(req.params.taskId);

  // include 쓰려면 models/index.js에 TaskTag->Tag association 필요(아래 패치 참고)
  const rows = await models.TaskTag.findAll({
    where: { task_id: taskId },
    include: [{ model: models.Tag, as: "tag" }],
    order: [["created_at", "ASC"]],
  });

  return sendOk(res, { taskTags: rows });
});

// POST /projects/:projectId/tasks/:taskId/tags  body: { tagId }
router.post("/projects/:projectId/tasks/:taskId/tags", async (req, res) => {
  const ok = await loadProjectTaskOr404(req, res);
  if (!ok) return;

  const workspaceId = req.workspace.id;
  const taskId = Number(req.params.taskId);
  const { tagId } = req.body;

  if (!tagId) return sendError(res, 400, "BAD_REQUEST", "tagId required");

  const tag = await models.Tag.findOne({
    where: { id: tagId, workspace_id: workspaceId },
  });
  if (!tag) return sendError(res, 404, "NOT_FOUND", "tag not found in workspace");

  try {
    const row = await models.TaskTag.create({ task_id: taskId, tag_id: tagId });
    return sendOk(res, { taskTag: row });
  } catch (e) {
    return sendError(res, 409, "CONFLICT", "tag already attached");
  }
});

// DELETE /projects/:projectId/tasks/:taskId/tags/:tagId
router.delete("/projects/:projectId/tasks/:taskId/tags/:tagId", async (req, res) => {
  const ok = await loadProjectTaskOr404(req, res);
  if (!ok) return;

  const taskId = Number(req.params.taskId);
  const tagId = Number(req.params.tagId);

  if (!tagId) return sendError(res, 400, "BAD_REQUEST", "invalid tagId");

  await models.TaskTag.destroy({ where: { task_id: taskId, tag_id: tagId } });
  return sendOk(res);
});

export default router;
