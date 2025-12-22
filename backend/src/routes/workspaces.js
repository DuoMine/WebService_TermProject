// src/routes/workspaces.js
import express from "express";
import { models, sequelize } from "../models/index.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { sendOk, sendError } from "../utils/http.js";
import { requireWorkspaceOwner } from "../middlewares/requireWorkspaceMember.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Workspaces
 *     description: Workspace management
 */

/**
 * @swagger
 * /workspaces:
 *   post:
 *     tags: [Workspaces]
 *     summary: Create workspace
 *     description: 생성자는 owner_id가 되며, workspace_members에도 자동 추가된다.
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "team-a" }
 *               description: { type: string, nullable: true, example: "our workspace" }
 *     responses:
 *       201:
 *         description: created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspace:
 *                       $ref: "#/components/schemas/Workspace"
 *               required: [ok, data]
 *       400:
 *         description: BAD_REQUEST (name required)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_ERROR
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   get:
 *     tags: [Workspaces]
 *     summary: List my workspaces
 *     description: 내가 속한(멤버인) 워크스페이스 목록을 반환한다. deleted_at=null만 조회.
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspaces:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/Workspace"
 *               required: [ok, data]
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/")
  .post(requireAuth, async (req, res) => {
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
  })
  .get(requireAuth, async (req, res) => {
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

/**
 * @swagger
 * /workspaces/{workspaceId}:
 *   get:
 *     tags: [Workspaces]
 *     summary: Get workspace detail
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspace:
 *                       $ref: "#/components/schemas/Workspace"
 *               required: [ok, data]
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   patch:
 *     tags: [Workspaces]
 *     summary: Update workspace (OWNER)
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "team-a-renamed" }
 *               description: { type: string, nullable: true, example: "updated" }
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     workspace:
 *                       $ref: "#/components/schemas/Workspace"
 *               required: [ok, data]
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: forbidden (not owner)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   delete:
 *     tags: [Workspaces]
 *     summary: Delete workspace (OWNER, soft delete)
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ok
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: forbidden (not owner)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/:workspaceId")
  .get(async (req, res) => {
    return sendOk(res, { workspace: req.workspace });
  })
  .patch(requireWorkspaceOwner(), async (req, res) => {
    const { name, description } = req.body;

    if (name !== undefined) req.workspace.name = name;
    if (description !== undefined) req.workspace.description = description;

    await req.workspace.save();
    return sendOk(res, { workspace: req.workspace });
  })
  .delete(requireWorkspaceOwner(), async (req, res) => {
    req.workspace.deleted_at = new Date();
    await req.workspace.save();
    return sendOk(res);
  });

/**
 * @swagger
 * /workspaces/{workspaceId}/members:
 *   get:
 *     tags: [Workspaces]
 *     summary: List workspace members
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     members:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           workspace_id: { type: integer, example: 1 }
 *                           user_id: { type: integer, example: 2 }
 *                           created_at: { type: string, example: "2025-12-22T10:00:00.000Z" }
 *                           user:
 *                             type: object
 *                             properties:
 *                               id: { type: integer, example: 2 }
 *                               email: { type: string, example: "u2@test.com" }
 *                               name: { type: string, example: "user2" }
 *                               role: { type: string, example: "USER" }
 *                               status: { type: string, example: "ACTIVE" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   post:
 *     tags: [Workspaces]
 *     summary: Add member to workspace (OWNER)
 *     description: owner는 이미 멤버로 간주되며, 중복 추가는 CONFLICT.
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: integer, example: 2 }
 *     responses:
 *       200:
 *         description: ok
 *       400:
 *         description: BAD_REQUEST (userId required)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: forbidden (not owner)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       409:
 *         description: CONFLICT (owner already member / already member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/:workspaceId/members")
  .get(async (req, res) => {
    const workspaceId = req.workspace.id;

    const members = await models.WorkspaceMember.findAll({
      where: { workspace_id: workspaceId },
      include: [
        {
          model: models.User,
          as: "user",
          attributes: ["id", "email", "name", "role", "status"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    return sendOk(res, { members });
  })
  .post(requireWorkspaceOwner(), async (req, res) => {
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

/**
 * @swagger
 * /workspaces/{workspaceId}/members/{userId}:
 *   delete:
 *     tags: [Workspaces]
 *     summary: Remove member from workspace (OWNER)
 *     description: owner는 제거할 수 없다.
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ok
 *       400:
 *         description: BAD_REQUEST (invalid userId / cannot remove owner)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: forbidden (not owner)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
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
