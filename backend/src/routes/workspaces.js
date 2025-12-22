// src/routes/workspaces.js
import express from "express";
import { models, sequelize } from "../models/index.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { sendOk, sendError } from "../utils/http.js";
import { requireWorkspaceOwner } from "../middlewares/requireWorkspaceMember.js";

const router = express.Router();

/**
 * POST /api/workspaces
 * - 생성자는 owner_id
 * - 생성자를 workspace_members에도 추가
 */
router.post("/", requireAuth, async (req, res) => {
  const userId = req.auth.userId;
  const { name, description } = req.body;

  if (!name) return sendError(res, 400, "BAD_REQUEST", "name required");

  const t = await sequelize.transaction();
  try {
    const ws = await models.Workspace.create(
      { name, description: description ?? null, owner_id: userId },
      { transaction: t }
    );

    await models.WorkspaceMember.create(
      { workspace_id: ws.id, user_id: userId },
      { transaction: t }
    );

    await t.commit();
    return sendOk(res, { workspace: ws }, 201);
  } catch (e) {
    await t.rollback();
    return sendError(res, 500, "INTERNAL_ERROR", e.message);
  }
});

/**
 * GET /api/workspaces
 * - 내가 속한 워크스페이스 목록
 */
router.get("/", requireAuth, async (req, res) => {
  const userId = req.auth.userId;

  const list = await models.Workspace.findAll({
    where: { deleted_at: null },
    include: [
      {
        model: models.WorkspaceMember,
        as: "members",
        where: { user_id: userId },
        attributes: [],
      },
    ],
    order: [["created_at", "DESC"]],
  });

  return sendOk(res, { workspaces: list });
});

/**
 * 아래부터는 routes/index.js에서
 * router.use("/workspaces/:workspaceId", requireAuth, requireWorkspaceMember())
 * 가 이미 적용되어 있음.
 * => req.workspace가 세팅되어 있고, 멤버가 아니면 여기까지 못 들어온다.
 */

// GET /api/workspaces/:workspaceId
router.get("/:workspaceId", async (req, res) => {
  return sendOk(res, { workspace: req.workspace });
});

// PATCH /api/workspaces/:workspaceId  (OWNER)
router.patch("/:workspaceId", requireWorkspaceOwner(), async (req, res) => {
  const { name, description } = req.body;

  if (name !== undefined) req.workspace.name = name;
  if (description !== undefined) req.workspace.description = description;

  await req.workspace.save();
  return sendOk(res, { workspace: req.workspace });
});

// DELETE /api/workspaces/:workspaceId (OWNER, soft delete)
router.delete("/:workspaceId", requireWorkspaceOwner(), async (req, res) => {
  req.workspace.deleted_at = new Date();
  await req.workspace.save();
  return sendOk(res);
});

/**
 * MEMBERS
 * - MEMBER: 목록 조회 가능
 * - OWNER: 추가/삭제 가능
 */

// GET /api/workspaces/:workspaceId/members
router.get("/:workspaceId/members", async (req, res) => {
  const workspaceId = req.workspace.id;

  const members = await models.WorkspaceMember.findAll({
    where: { workspace_id: workspaceId },
    include: [{ model: models.User, as: "user", attributes: ["id", "email", "name", "role", "status"] }],
    order: [["created_at", "ASC"]],
  });

  return sendOk(res, { members });
});

// POST /api/workspaces/:workspaceId/members  body: { userId } (OWNER)
router.post("/:workspaceId/members", requireWorkspaceOwner(), async (req, res) => {
  const workspaceId = req.workspace.id;
  const { userId } = req.body;

  if (!userId) return sendError(res, 400, "BAD_REQUEST", "userId required");

  if (Number(userId) === req.workspace.owner_id) {
    return sendError(res, 409, "CONFLICT", "owner already member");
  }

  const existed = await models.WorkspaceMember.findOne({
    where: { workspace_id: workspaceId, user_id: userId },
  });
  if (existed) return sendError(res, 409, "CONFLICT", "already member");

  await models.WorkspaceMember.create({ workspace_id: workspaceId, user_id: userId });
  return sendOk(res);
});

// DELETE /api/workspaces/:workspaceId/members/:userId (OWNER)
router.delete("/:workspaceId/members/:userId", requireWorkspaceOwner(), async (req, res) => {
  const workspaceId = req.workspace.id;
  const userId = Number(req.params.userId);

  if (!userId) return sendError(res, 400, "BAD_REQUEST", "invalid userId");

  if (userId === req.workspace.owner_id) {
    return sendError(res, 400, "BAD_REQUEST", "cannot remove owner");
  }

  await models.WorkspaceMember.destroy({
    where: { workspace_id: workspaceId, user_id: userId },
  });

  return sendOk(res);
});

export default router;
