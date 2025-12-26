// src/routes/projects.js
import express from "express";
import { Op } from "sequelize";
import { models } from "../models/index.js";
import { sendOk, sendError, sendCreated, sendNoContent } from "../utils/http.js";
import { parsePagination, parseSort, parseFilters, toPageResult } from "../utils/listQuery.js";
import { rateLimit } from "../middlewares/rateLimit.js";

const router = express.Router({ mergeParams: true });

/**
 * 전제:
 * app.js에서 아래가 먼저 적용됨
 * app.use("/api/workspaces/:workspaceId", requireAuth, requireWorkspaceMember());
 *
 * => req.auth 존재
 * => req.workspace 존재 (deleted_at null까지 확인됨)
 */

/**
 * @swagger
 * tags:
 *   - name: Projects
 *     description: Project management
 */

/**
 * @swagger
 * /workspaces/{workspaceId}/projects:
 *   get:
 *     tags: [Projects]
 *     summary: List projects in workspace
 *     description: 'deleted_at=null인 프로젝트만 반환한다. Pagination(1-base) + sort + filters(keyword,status,dateFrom/dateTo). Allowed sort fields: id, created_at, name, status'
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 50 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: "created_at,DESC" }
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, ARCHIVED] }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: ok
 *       403:
 *         description: FORBIDDEN ( not workspace member)
 *       500:
 *         description: INTERNAL_SERVER_ERROR / DATABASE_ERROR / UNKNOWN_ERROR
 *
 *   post:
 *     tags: [Projects]
 *     summary: Create project in workspace
 *     security: [{ cookieAuth: [] }]
 */
router
  .route("/")
  .get(async (req, res) => {
    const workspaceId = req.workspace.id;

    const { page, size, offset, limit } = parsePagination(req.query);

    const { sort, order } = parseSort(
      req.query,
      ["id", "created_at", "name", "status"],
      "created_at,DESC"
    );

    const f = parseFilters(req.query);
    const where = { workspace_id: workspaceId, deleted_at: null };

    if (f.keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${f.keyword}%` } },
        { description: { [Op.like]: `%${f.keyword}%` } },
      ];
    }

    if (f.status && ["ACTIVE", "ARCHIVED"].includes(f.status)) {
      where.status = f.status;
    }

    if (f.dateFrom || f.dateTo) {
      where.created_at = {};
      if (f.dateFrom) where.created_at[Op.gte] = new Date(`${f.dateFrom}T00:00:00.000Z`);
      if (f.dateTo) where.created_at[Op.lte] = new Date(`${f.dateTo}T23:59:59.999Z`);
    }

    const result = await models.Project.findAndCountAll({
      where,
      order,
      limit,
      offset,
    });

    return sendOk(res, toPageResult(result, page, size, sort));
  })
  .post(
    rateLimit({
      windowSec: 60,
      max: 30,
      keyGenerator: (req) =>
        `rl:projects:create:${req.auth.userId}:${req.workspace.id}`,
    }),
    async (req, res) => {
      const workspaceId = req.workspace.id;
      const userId = req.auth.userId;
      const { name, description } = req.body;

      if (!name) return sendError(res, "BAD_REQUEST", "name required");

      const p = await models.Project.create({
        workspace_id: workspaceId,
        name,
        description: description ?? null,
        status: "ACTIVE",
        created_by: userId,
      });

      return sendCreated(res, { project: p });
    }
  );

/**
 * @swagger
 * /workspaces/{workspaceId}/projects/{projectId}:
 *   get:
 *     tags: [Projects]
 *     summary: Get project detail
 *   patch:
 *     tags: [Projects]
 *     summary: Update project
 *   delete:
 *     tags: [Projects]
 *     summary: Delete project (soft delete)
 */
router
  .route("/:projectId")
  .get(async (req, res) => {
    const workspaceId = req.workspace.id;
    const projectId = Number(req.params.projectId);
    if (!projectId) return sendError(res, "BAD_REQUEST", "invalid projectId");

    const p = await models.Project.findOne({
      where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
    });
    if (!p) return sendError(res, "RESOURCE_NOT_FOUND", "project not found");

    return sendOk(res, { project: p });
  })
  .patch(
    rateLimit({
      windowSec: 60,
      max: 30,
      keyGenerator: (req) =>
        `rl:projects:update:${req.auth.userId}:${req.params.projectId}`,
    }),
    async (req, res) => {
      const workspaceId = req.workspace.id;
      const projectId = Number(req.params.projectId);
      if (!projectId) return sendError(res, "BAD_REQUEST", "invalid projectId");

      const p = await models.Project.findOne({
        where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
      });
      if (!p) return sendError(res, "RESOURCE_NOT_FOUND", "project not found");

      const { name, description, status } = req.body;

      if (name !== undefined) p.name = name;
      if (description !== undefined) p.description = description;

      if (status !== undefined) {
        if (!["ACTIVE", "ARCHIVED"].includes(status)) {
          return sendError(res, "BAD_REQUEST", "invalid status");
        }
        p.status = status;
      }

      await p.save();
      return sendOk(res, { project: p });
    }
  )
  .delete(
    rateLimit({
      windowSec: 60,
      max: 20,
      keyGenerator: (req) =>
        `rl:projects:delete:${req.auth.userId}:${req.params.projectId}`,
    }),
    async (req, res) => {
      const workspaceId = req.workspace.id;
      const projectId = Number(req.params.projectId);
      if (!projectId) return sendError(res, "BAD_REQUEST", "invalid projectId");

      const p = await models.Project.findOne({
        where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
      });
      if (!p) return sendError(res, "RESOURCE_NOT_FOUND", "project not found");

      p.deleted_at = new Date();
      await p.save();

      return sendNoContent(res);
    }
  );

export default router;
