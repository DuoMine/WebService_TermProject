import express from "express";
import { Op } from "sequelize";
import { models, sequelize } from "../models/index.js";

/**
 * 🔽 기존 JWT 인증 (유지)
 * import { requireAuth } from "../middlewares/requireAuth.js";
 */
import { requireSession } from "../middlewares/requireSession.js";

import { sendOk, sendError, sendCreated, sendNoContent } from "../utils/http.js";
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
 */
router
  .route("/")
  .post(requireSession, async (req, res) => {
    const userId = req.auth.userId;
    const { name, description } = req.body;
    if (!name) return sendError(res, "BAD_REQUEST", "name required");

    try {
      const ws = await sequelize.transaction(async (t) => {
        const created = await models.Workspace.create(
          { name, description: description ?? null, owner_id: userId },
          { transaction: t }
        );
        await models.WorkspaceMember.create(
          { workspace_id: created.id, user_id: userId },
          { transaction: t }
        );
        return created;
      });

      return sendCreated(res, { workspace: ws });
    } catch (e) {
      console.error("[POST /workspaces] error:", e);
      return sendError(res, "INTERNAL_SERVER_ERROR", "internal server error");
    }
  })

  /**
   * @swagger
   * /workspaces:
   *   get:
   *     tags: [Workspaces]
   *     summary: List my workspaces
   *     security: [{ cookieAuth: [] }]
   */
  .get(requireSession, async (req, res) => {
    const userId = req.auth.userId;

    // 1) pagination (1-base)
    const { page, size, offset, limit } = parsePagination(req.query);

    // 2) sort whitelist
    const { sort, order } = parseSort(req.query, ["id", "created_at", "name"], "created_at,DESC");

    // 3) filters
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

    // 4) 내가 속한 workspace만
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
      distinct: true,
    });

    return sendOk(res, toPageResult(result, page, size, sort));
  });

/**
 * 아래부터는 routes/index.js에서
 * router.use("/workspaces/:workspaceId", requireSession, requireWorkspaceMember())
 * 가 이미 적용되어 있음.
 * => req.workspace가 세팅되어 있고, 멤버가 아니면 여기까지 못 들어온다.
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

router
  .route("/:workspaceId/members")
  .get(async (req, res) => {
    const workspaceId = req.workspace.id;

    const { page, size, offset, limit } = parsePagination(req.query);
    const { sort, order } = parseSort(req.query, ["created_at", "user_id"], "created_at,ASC");
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
    return sendOk(res, { workspace: req.workspace });
  });

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
