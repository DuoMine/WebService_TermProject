// src/routes/comments.js
import express from "express";
import { Op } from "sequelize";
import { models } from "../models/index.js";
import { sendOk, sendError } from "../utils/http.js";
import { parsePagination, parseSort, parseFilters, toPageResult } from "../utils/listQuery.js";

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

/**
 * @swagger
 * tags:
 *   - name: Comments
 *     description: Comment management
 */

/**
 * @swagger
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/comments:
 *   get:
 *     tags: [Comments]
 *     summary: List comments in task
 *     description: 'created_at ASC 기본 정렬. deleted_at=null만 반환. Pagination(1-base) + sort + filters(keyword,authorId,dateFrom/dateTo)'
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
 *       - in: path
 *         name: taskId
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
 *         schema: { type: string, default: "created_at,ASC" }
 *         description: 'Sort format: field,(ASC|DESC). Allowed fields: id, created_at, user_id'
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *         description: 'Search by comment content (LIKE)'
 *       - in: query
 *         name: authorId
 *         schema: { type: integer }
 *         description: 'Filter by user_id (author)'
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
 *               properties:
 *                 content:
 *                   type: array
 *                   items:
 *                     $ref: "#/components/schemas/Comment"
 *                 page: { type: integer, example: 1 }
 *                 size: { type: integer, example: 20 }
 *                 totalElements: { type: integer, example: 153 }
 *                 totalPages: { type: integer, example: 8 }
 *                 sort: { type: string, example: "created_at,ASC" }
 *               required: [content, page, size, totalElements, totalPages]
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid taskId)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: NOT_FOUND (project not found / task not found)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   post:
 *     tags: [Comments]
 *     summary: Create comment
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
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, example: "Looks good." }
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
 *                     comment:
 *                       $ref: "#/components/schemas/Comment"
 *               required: [ok, data]
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid taskId / content required)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: NOT_FOUND (project not found / task not found)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/")
  .get(async (req, res) => {
    const ok = await loadProjectTaskOr404(req, res);
    if (!ok) return;

    const taskId = Number(req.params.taskId);

    // ✅ 1) pagination (1-base)
    const { page, size, offset, limit } = parsePagination(req.query);

    // ✅ 2) sort whitelist
    const { sort, order } = parseSort(
      req.query,
      ["id", "created_at", "user_id"],
      "created_at,ASC"
    );

    // ✅ 3) filters: keyword/authorId/dateFrom/dateTo
    const f = parseFilters(req.query);
    const where = { task_id: taskId, deleted_at: null };

    if (f.keyword) {
      where.content = { [Op.like]: `%${f.keyword}%` };
    }

    if (f.authorId) {
      const aid = Number(f.authorId);
      if (Number.isFinite(aid) && aid > 0) where.user_id = aid;
    }

    if (f.dateFrom || f.dateTo) {
      where.created_at = {};
      if (f.dateFrom) where.created_at[Op.gte] = new Date(`${f.dateFrom}T00:00:00.000Z`);
      if (f.dateTo) where.created_at[Op.lte] = new Date(`${f.dateTo}T23:59:59.999Z`);
    }

    const result = await models.Comment.findAndCountAll({
      where,
      order,
      limit,
      offset,
    });

    // ✅ 4) 과제 포맷(래핑 없이)
    return res.status(200).json(toPageResult(result, page, size, sort));
  })
  .post(async (req, res) => {
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

/**
 * @swagger
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/comments/{commentId}:
 *   patch:
 *     tags: [Comments]
 *     summary: Update comment
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
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: string, example: "Updated comment." }
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
 *                     comment:
 *                       $ref: "#/components/schemas/Comment"
 *               required: [ok, data]
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid taskId / invalid commentId)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: NOT_FOUND (project not found / task not found / comment not found)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   delete:
 *     tags: [Comments]
 *     summary: Delete comment (soft delete)
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
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ok
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid taskId / invalid commentId)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: NOT_FOUND (project not found / task not found / comment not found)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/:commentId")
  .patch(async (req, res) => {
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
  })
  .delete(async (req, res) => {
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
