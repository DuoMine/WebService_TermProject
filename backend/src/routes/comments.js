// src/routes/comments.js
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
 * => req.workspace 존재
 */

async function loadProjectTaskOr404(req, res) {
  const workspaceId = req.workspace.id;
  const projectId = Number(req.params.projectId);
  const taskId = Number(req.params.taskId);

  if (!projectId) {
    sendError(res, "BAD_REQUEST", "invalid projectId");
    return null;
  }
  if (!taskId) {
    sendError(res, "BAD_REQUEST", "invalid taskId");
    return null;
  }

  const project = await models.Project.findOne({
    where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
  });
  if (!project) {
    sendError(res, "RESOURCE_NOT_FOUND", "project not found");
    return null;
  }

  const task = await models.Task.findOne({
    where: { id: taskId, project_id: projectId, deleted_at: null },
  });
  if (!task) {
    sendError(res, "RESOURCE_NOT_FOUND", "task not found");
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
 *     description: 'deleted_at=null만 반환. Pagination(1-base) + sort + filters(keyword,authorId,dateFrom/dateTo). Allowed sort fields: id, created_at, user_id'
 *     security: [{ cookieAuth: [] }]
 *   post:
 *     tags: [Comments]
 *     summary: Create comment
 */
router
  .route("/")
  .get(async (req, res) => {
    const ok = await loadProjectTaskOr404(req, res);
    if (!ok) return;

    const taskId = Number(req.params.taskId);

    const { page, size, offset, limit } = parsePagination(req.query);

    const { sort, order } = parseSort(
      req.query,
      ["id", "created_at", "user_id"],
      "created_at,ASC"
    );

    const f = parseFilters(req.query);
    const where = { task_id: taskId, deleted_at: null };

    if (f.keyword) where.content = { [Op.like]: `%${f.keyword}%` };

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

    return sendOk(res, toPageResult(result, page, size, sort));
  })
  .post(
    rateLimit({
      windowSec: 60,
      max: 60,
      keyGenerator: (req) =>
        `rl:comments:create:${req.auth.userId}:${req.params.taskId}`,
    }),
    async (req, res) => {
      const ok = await loadProjectTaskOr404(req, res);
      if (!ok) return;

      const taskId = Number(req.params.taskId);
      const userId = req.auth.userId;
      const { content } = req.body;

      if (!content) return sendError(res, "BAD_REQUEST", "content required");

      const c = await models.Comment.create({
        task_id: taskId,
        user_id: userId,
        content,
      });

      return sendCreated(res, { comment: c });
    }
  );

/**
 * @swagger
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/comments/{commentId}:
 *   patch:
 *     tags: [Comments]
 *     summary: Update comment
 *   delete:
 *     tags: [Comments]
 *     summary: Delete comment (soft delete)
 */
router
  .route("/:commentId")
  .patch(
    rateLimit({
      windowSec: 60,
      max: 30,
      keyGenerator: (req) =>
        `rl:comments:update:${req.auth.userId}:${req.params.commentId}`,
    }),
    async (req, res) => {
      const ok = await loadProjectTaskOr404(req, res);
      if (!ok) return;

      const taskId = Number(req.params.taskId);
      const commentId = Number(req.params.commentId);
      if (!commentId) return sendError(res, "BAD_REQUEST", "invalid commentId");

      const { content } = req.body;

      const c = await models.Comment.findOne({
        where: { id: commentId, task_id: taskId, deleted_at: null },
      });
      if (!c) return sendError(res, "RESOURCE_NOT_FOUND", "comment not found");

      if (content !== undefined) c.content = content;
      await c.save();

      return sendOk(res, { comment: c });
    }
  )
  .delete(
    rateLimit({
      windowSec: 60,
      max: 20,
      keyGenerator: (req) =>
        `rl:comments:delete:${req.auth.userId}:${req.params.commentId}`,
    }),
    async (req, res) => {
      const ok = await loadProjectTaskOr404(req, res);
      if (!ok) return;

      const taskId = Number(req.params.taskId);
      const commentId = Number(req.params.commentId);
      if (!commentId) return sendError(res, "BAD_REQUEST", "invalid commentId");

      const c = await models.Comment.findOne({
        where: { id: commentId, task_id: taskId, deleted_at: null },
      });
      if (!c) return sendError(res, "RESOURCE_NOT_FOUND", "comment not found");

      c.deleted_at = new Date();
      await c.save();

      return sendNoContent(res);
    }
  );

export default router;
