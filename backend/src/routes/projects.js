// src/routes/projects.js
import express from "express";
import { Op } from "sequelize";
import { models } from "../models/index.js";
import { sendOk, sendError, sendCreated, sendNoContent } from "../utils/http.js";
import { parsePagination, parseSort, parseFilters, toPageResult } from "../utils/listQuery.js";

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
 *         description: 'Page number (1-base)'
 *       - in: query
 *         name: size
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 50 }
 *         description: 'Page size (max 50)'
 *       - in: query
 *         name: sort
 *         schema: { type: string, default: "created_at,DESC" }
 *         description: 'Sort format: field,(ASC|DESC). Allowed fields: id, created_at, name, status'
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *         description: 'Search by project name/description (LIKE)'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, ARCHIVED] }
 *         description: 'Filter by project status'
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *         description: 'created_at >= dateFrom (YYYY-MM-DD)'
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *         description: 'created_at <= dateTo (YYYY-MM-DD)'
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [content, page, size, totalElements, totalPages]
 *               properties:
 *                 content:
 *                   type: array
 *                   items: { $ref: "#/components/schemas/Project" }
 *                 page: { type: integer, example: 1 }
 *                 size: { type: integer, example: 20 }
 *                 totalElements: { type: integer, example: 153 }
 *                 totalPages: { type: integer, example: 8 }
 *                 sort: { type: string, example: "created_at,DESC" }
 *       403:
 *         description: FORBIDDEN ( not workspace member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR / DATABASE_ERROR / UNKNOWN_ERROR
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   post:
 *     tags: [Projects]
 *     summary: Create project in workspace
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
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "backend" }
 *               description: { type: string, nullable: true, example: "api server" }
 *     responses:
 *       201:
 *         description: created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [project]
 *               properties:
 *                 project:
 *                   $ref: "#/components/schemas/Project"
 *       400:
 *         description: BAD_REQUEST (name required). VALIDATION_FAILED may include details.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN ( not workspace member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR / DATABASE_ERROR / UNKNOWN_ERROR
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/")
  .get(async (req, res) => {
    const workspaceId = req.workspace.id;

    // ✅ 1) pagination (1-base)
    const { page, size, offset, limit } = parsePagination(req.query);

    // ✅ 2) sort whitelist (snake_case)
    const { sort, order } = parseSort(
      req.query,
      ["id", "created_at", "name", "status"],
      "created_at,DESC"
    );

    // ✅ 3) filters: keyword/status/dateFrom/dateTo
    const f = parseFilters(req.query);
    const where = { workspace_id: workspaceId, deleted_at: null };

    if (f.keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${f.keyword}%` } },
        { description: { [Op.like]: `%${f.keyword}%` } },
      ];
    }

    if (f.status) {
      // 안전하게 enum만 허용
      if (["ACTIVE", "ARCHIVED"].includes(f.status)) where.status = f.status;
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
  .post(async (req, res) => {
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
  });

/**
 * @swagger
 * /workspaces/{workspaceId}/projects/{projectId}:
 *   get:
 *     tags: [Projects]
 *     summary: Get project detail
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [project]
 *               properties:
 *                 project:
 *                   $ref: "#/components/schemas/Project"
 *       400:
 *         description: BAD_REQUEST (invalid projectId). VALIDATION_FAILED may include details.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN ( not workspace member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: RESOURCE_NOT_FOUND (project not found)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR / DATABASE_ERROR / UNKNOWN_ERROR
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   patch:
 *     tags: [Projects]
 *     summary: Update project
 *     description: status는 ACTIVE/ARCHIVED만 허용.
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "backend-renamed" }
 *               description: { type: string, nullable: true, example: "updated desc" }
 *               status: { type: string, enum: [ACTIVE, ARCHIVED], example: "ARCHIVED" }
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [project]
 *               properties:
 *                 project:
 *                   $ref: "#/components/schemas/Project"
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid status). VALIDATION_FAILED may include details.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN ( not workspace member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: RESOURCE_NOT_FOUND (project not found)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR / DATABASE_ERROR / UNKNOWN_ERROR
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   delete:
 *     tags: [Projects]
 *     summary: Delete project (soft delete)
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: No Content (soft deleted)
 *       400:
 *         description: BAD_REQUEST (invalid projectId). VALIDATION_FAILED may include details.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN ( not workspace member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: RESOURCE_NOT_FOUND (project not found)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR / DATABASE_ERROR / UNKNOWN_ERROR
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
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
  .patch(async (req, res) => {
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
  })
  .delete(async (req, res) => {
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
  });

export default router;
