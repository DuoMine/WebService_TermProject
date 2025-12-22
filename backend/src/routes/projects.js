// src/routes/projects.js
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

// GET /api/workspaces/:workspaceId/projects
router.get("/", async (req, res) => {
  const workspaceId = req.workspace.id;

  const projects = await models.Project.findAll({
    where: { workspace_id: workspaceId, deleted_at: null },
    order: [["created_at", "DESC"]],
  });

  return sendOk(res, { projects });
});

// POST /api/workspaces/:workspaceId/projects
router.post("/", async (req, res) => {
  const workspaceId = req.workspace.id;
  const userId = req.auth.userId;
  const { name, description } = req.body;

  if (!name) return sendError(res, 400, "BAD_REQUEST", "name required");

  const p = await models.Project.create({
    workspace_id: workspaceId,
    name,
    description: description ?? null,
    status: "ACTIVE",
    created_by: userId,
  });

  return sendOk(res, { project: p }, 201);
});

// GET /api/workspaces/:workspaceId/projects/:projectId
router.get("/:projectId", async (req, res) => {
  const workspaceId = req.workspace.id;
  const projectId = Number(req.params.projectId);
  if (!projectId) return sendError(res, 400, "BAD_REQUEST", "invalid projectId");

  const p = await models.Project.findOne({
    where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
  });
  if (!p) return sendError(res, 404, "NOT_FOUND", "project not found");

  return sendOk(res, { project: p });
});

// PATCH /api/workspaces/:workspaceId/projects/:projectId
router.patch("/:projectId", async (req, res) => {
  const workspaceId = req.workspace.id;
  const projectId = Number(req.params.projectId);
  if (!projectId) return sendError(res, 400, "BAD_REQUEST", "invalid projectId");

  const p = await models.Project.findOne({
    where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
  });
  if (!p) return sendError(res, 404, "NOT_FOUND", "project not found");

  const { name, description, status } = req.body;

  if (name !== undefined) p.name = name;
  if (description !== undefined) p.description = description;

  if (status !== undefined) {
    if (!["ACTIVE", "ARCHIVED"].includes(status)) {
      return sendError(res, 400, "BAD_REQUEST", "invalid status");
    }
    p.status = status;
  }

  await p.save();
  return sendOk(res, { project: p });
});

// DELETE /api/workspaces/:workspaceId/projects/:projectId (soft delete)
router.delete("/:projectId", async (req, res) => {
  const workspaceId = req.workspace.id;
  const projectId = Number(req.params.projectId);
  if (!projectId) return sendError(res, 400, "BAD_REQUEST", "invalid projectId");

  const p = await models.Project.findOne({
    where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
  });
  if (!p) return sendError(res, 404, "NOT_FOUND", "project not found");

  p.deleted_at = new Date();
  await p.save();

  return sendOk(res);
});

export default router;
