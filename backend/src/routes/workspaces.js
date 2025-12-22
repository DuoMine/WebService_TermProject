// src/routes/workspaces.js
import express from "express";
import { Op } from "sequelize";
import { models, sequelize } from "../models/index.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { sendOk, sendError } from "../utils/http.js";
import { requireWorkspaceOwner } from "../middlewares/requireWorkspaceMember.js";
import { parsePagination, parseSort, parseFilters, toPageResult } from "../utils/listQuery.js";

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
 *         description: INTERNAL_SERVER_ERROR
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   get:
 *     tags: [Workspaces]
 *     summary: List my workspaces
 *     description: 내가 속한(멤버인) 워크스페이스 목록(soft delete 제외). Pagination(1-base) + sort + filters(keyword, dateFrom/dateTo)
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *         description: Page number (1-base)
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 50 }
 *         description: Page size (max 50)
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: "created_at,DESC" }
 *         description: 'Sort format "field,ASC|DESC" (allowed: id, created_at, name)'
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *         description: Search by workspace name/description (LIKE)
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *         description: created_at >= dateFrom (YYYY-MM-DD)
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *         description: created_at <= dateTo (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: array
 *                   items: { $ref: "#/components/schemas/Workspace" }
 *                 page: { type: integer, example: 1 }
 *                 size: { type: integer, example: 20 }
 *                 totalElements: { type: integer, example: 153 }
 *                 totalPages: { type: integer, example: 8 }
 *                 sort: { type: string, example: "created_at,DESC" }
 *               required: [content, page, size, totalElements, totalPages]
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

    if (!name) return sendError(res, "BAD_REQUEST", "name required");

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
      return sendCreated(res, { workspace: ws });
    } catch (e) {
      await t.rollback();
      return sendError(res, "INTERNAL_SERVER_ERROR", "internal server error");
    }
  })
  .get(requireAuth, async (req, res) => {
    const userId = req.auth.userId;

    // ✅ 1) pagination (1-base)
    const { page, size, offset, limit } = parsePagination(req.query);

    // ✅ 2) sort whitelist (snake_case 기준)
    const { sort, order } = parseSort(req.query, ["id", "created_at", "name"], "created_at,DESC");

    // ✅ 3) filters: keyword, dateFrom/dateTo
    const f = parseFilters(req.query);

    const where = { deleted_at: null };

    if (f.keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${f.keyword}%` } },
        { description: { [Op.like]: `%${f.keyword}%` } },
      ];
    }

    if (f.dateFrom || f.dateTo) {
      where.created_at = {};
      if (f.dateFrom) where.created_at[Op.gte] = new Date(`${f.dateFrom}T00:00:00.000Z`);
      if (f.dateTo) where.created_at[Op.lte] = new Date(`${f.dateTo}T23:59:59.999Z`);
    }

    // ✅ 4) 목록: 내가 속한 workspace만
    const result = await models.Workspace.findAndCountAll({
      where,
      include: [
        {
          model: models.WorkspaceMember,
          as: "members",
          where: { user_id: userId },
          attributes: [],
        },
      ],
      order,
      limit,
      offset,
      distinct: true, // include로 count 중복 방지
    });

    // ✅ 5) 과제 포맷 그대로(래핑 없이)
    return sendOk(res, toPageResult(result, page, size, sort));
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
 *         description: FORBIDDEN / not member (middleware)
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
 *         description: FORBIDDEN / not member (middleware)
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
 *         description: FORBIDDEN / not member (middleware)
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
    return sendNoContent(res);
  });

/**
 * @swagger
 * /workspaces/{workspaceId}/members:
 *   get:
 *     tags: [Workspaces]
 *     summary: List workspace members
 *     description: Pagination(1-base) + sort + filters(keyword, role)
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *         description: Page number (1-base)
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 50 }
 *         description: Page size (max 50)
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: "created_at,ASC" }
 *         description: 'Sort format "field,ASC|DESC" (allowed: created_at, user_id)'
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *         description: Search by user name/email (LIKE)
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [USER, ADMIN] }
 *         description: Filter by user.role
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 content:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       workspace_id: { type: integer, example: 1 }
 *                       user_id: { type: integer, example: 2 }
 *                       created_at: { type: string, example: "2025-12-22T10:00:00.000Z" }
 *                       user:
 *                         type: object
 *                         properties:
 *                           id: { type: integer, example: 2 }
 *                           email: { type: string, example: "u2@test.com" }
 *                           name: { type: string, example: "user2" }
 *                           role: { type: string, example: "USER" }
 *                           status: { type: string, example: "ACTIVE" }
 *                 page: { type: integer, example: 1 }
 *                 size: { type: integer, example: 20 }
 *                 totalElements: { type: integer, example: 153 }
 *                 totalPages: { type: integer, example: 8 }
 *                 sort: { type: string, example: "created_at,ASC" }
 *               required: [content, page, size, totalElements, totalPages]
 *       401:
 *         description: FORBIDDEN / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   post:
 *     tags: [Workspaces]
 *     summary: Add member to workspace (OWNER)
 *     description: owner는 이미 멤버로 간주되며, 중복 추가는 DUPLICATE_RESOURCE.
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
 *         description: FORBIDDEN / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: forbidden (not owner)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       409:
 *         description: DUPLICATE_RESOURCE (owner already member / already member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/:workspaceId/members")
  .get(async (req, res) => {
    const workspaceId = req.workspace.id;

    // ✅ 1) pagination
    const { page, size, offset, limit } = parsePagination(req.query);

    // ✅ 2) sort whitelist (멤버 목록에서 유효한 필드만)
    const { sort, order } = parseSort(req.query, ["created_at", "user_id"], "created_at,ASC");

    // ✅ 3) filters: keyword, role
    const f = parseFilters(req.query);

    const where = { workspace_id: workspaceId };
    const userWhere = {};

    if (f.role) userWhere.role = f.role;

    if (f.keyword) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${f.keyword}%` } },
        { email: { [Op.like]: `%${f.keyword}%` } },
      ];
    }

    const result = await models.WorkspaceMember.findAndCountAll({
      where,
      include: [
        {
          model: models.User,
          as: "user",
          attributes: ["id", "email", "name", "role", "status"],
          ...(Object.keys(userWhere).length ? { where: userWhere } : {}),
        },
      ],
      order,
      limit,
      offset,
      distinct: true,
    });

    // ✅ 4) 과제 포맷(래핑 없이)
    return sendOk(res, toPageResult(result, page, size, sort));
  })
  .post(requireWorkspaceOwner(), async (req, res) => {
    const workspaceId = req.workspace.id;
    const { userId } = req.body;

    if (!userId) return sendError(res, "BAD_REQUEST", "userId required");

    if (Number(userId) === req.workspace.owner_id) {
      return sendError(res, "DUPLICATE_RESOURCE", "owner already member");
    }

    const existed = await models.WorkspaceMember.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });
    if (existed) return sendError(res, "DUPLICATE_RESOURCE", "already member");

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
 *         description: FORBIDDEN / not member (middleware)
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

  if (!userId) return sendError(res, "BAD_REQUEST", "invalid userId");

  if (userId === req.workspace.owner_id) {
    return sendError(res, "BAD_REQUEST", "cannot remove owner");
  }

  await models.WorkspaceMember.destroy({
    where: { workspace_id: workspaceId, user_id: userId },
  });

  return sendNoContent(res);
});

export default router;
