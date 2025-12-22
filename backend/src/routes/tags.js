// src/routes/tags.js
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
 * => req.workspace 존재
 */

// 공통: project/task 스코프 확인
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
 *   - name: Tags
 *     description: Workspace tags and task-tag mapping
 */

/**
 * =========================
 * Workspace Tags
 * =========================
 * 실제 경로:
 * - GET    /api/workspaces/:workspaceId/tags
 * - POST   /api/workspaces/:workspaceId/tags
 * - DELETE /api/workspaces/:workspaceId/tags/:tagId
 */

/**
 * @swagger
 * /workspaces/{workspaceId}/tags:
 *   get:
 *     tags: [Tags]
 *     summary: List workspace tags
 *     description: 'Pagination(1-base) + sort + filters(keyword,dateFrom/dateTo). Allowed sort fields: id, name, created_at'
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
 *         schema: { type: string, default: "name,ASC" }
 *         description: 'Sort format: field,(ASC|DESC). Allowed fields: id, name, created_at'
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *         description: 'Search by tag name (LIKE)'
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
 *                   items:
 *                     $ref: "#/components/schemas/Tag"
 *                 page: { type: integer, example: 1 }
 *                 size: { type: integer, example: 20 }
 *                 totalElements: { type: integer, example: 153 }
 *                 totalPages: { type: integer, example: 8 }
 *                 sort: { type: string, example: "name,ASC" }
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
 *     tags: [Tags]
 *     summary: Create workspace tag
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
 *               name: { type: string, example: "bug" }
 *     responses:
 *       201:
 *         description: created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [tag]
 *               properties:
 *                 tag:
 *                   $ref: "#/components/schemas/Tag"
 *       400:
 *         description: BAD_REQUEST (name required / invalid workspace_id / invalid tag data). VALIDATION_FAILED may include details.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN ( not workspace member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       409:
 *         description: DUPLICATE_RESOURCE (tag already exists)
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
  .route("/tags")
  .get(async (req, res) => {
    const workspaceId = req.workspace.id;

    // ✅ 1) pagination
    const { page, size, offset, limit } = parsePagination(req.query);

    // ✅ 2) sort whitelist
    const { sort, order } = parseSort(req.query, ["id", "name", "created_at"], "name,ASC");

    // ✅ 3) filters: keyword/dateFrom/dateTo
    const f = parseFilters(req.query);
    const where = { workspace_id: workspaceId };

    if (f.keyword) where.name = { [Op.like]: `%${f.keyword}%` };

    if (f.dateFrom || f.dateTo) {
      where.created_at = {};
      if (f.dateFrom) where.created_at[Op.gte] = new Date(`${f.dateFrom}T00:00:00.000Z`);
      if (f.dateTo) where.created_at[Op.lte] = new Date(`${f.dateTo}T23:59:59.999Z`);
    }

    const result = await models.Tag.findAndCountAll({
      where,
      order,
      limit,
      offset,
    });

    return sendOk(res, toPageResult(result, page, size, sort));
  })
  .post(async (req, res) => {
    const workspaceId = req.workspace.id;
    const { name } = req.body;

    if (!name) return sendError(res, "BAD_REQUEST", "name required");

    try {
      const tag = await models.Tag.create({ workspace_id: workspaceId, name });
      return sendCreated(res, { tag: tag });
    } catch (e) {
      console.error(
        "[POST /tags] create failed:",
        e?.name,
        e?.message,
        e?.original?.code,
        e?.original?.errno
      );

      if (e?.name === "SequelizeUniqueConstraintError") {
        return sendError(res, "DUPLICATE_RESOURCE", "tag already exists");
      }

      if (e?.name === "SequelizeForeignKeyConstraintError") {
        return sendError(res, "BAD_REQUEST", "invalid workspace_id");
      }
      if (e?.name === "SequelizeValidationError") {
        return sendError(res, "BAD_REQUEST", "invalid tag data");
      }

      return sendError(res, "INTERNAL_SERVER_ERROR", "failed to create tag");
    }
  });

/**
 * @swagger
 * /workspaces/{workspaceId}/tags/{tagId}:
 *   delete:
 *     tags: [Tags]
 *     summary: Delete workspace tag
 *     description: 물리 삭제(destroy). tagId가 workspace에 속하지 않으면 RESOURCE_NOT_FOUND.
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: No Content (deleted)
 *       400:
 *         description: BAD_REQUEST (invalid tagId). VALIDATION_FAILED may include details.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN ( not workspace member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: RESOURCE_NOT_FOUND (tag not found)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR / DATABASE_ERROR / UNKNOWN_ERROR
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router.delete("/tags/:tagId", async (req, res) => {
  const workspaceId = req.workspace.id;
  const tagId = Number(req.params.tagId);

  if (!tagId) return sendError(res, "BAD_REQUEST", "invalid tagId");

  const tag = await models.Tag.findOne({
    where: { id: tagId, workspace_id: workspaceId },
  });
  if (!tag) return sendError(res, "RESOURCE_NOT_FOUND", "tag not found");

  await tag.destroy();
  return sendNoContent(res);
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

/**
 * @swagger
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/tags:
 *   get:
 *     tags: [Tags]
 *     summary: List tags attached to task
 *     description: 'Pagination(1-base) + sort + filters(keyword,tagId,dateFrom/dateTo). include로 Tag 포함. Allowed sort fields: created_at, tag_id'
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
 *         description: 'Sort format: field,(ASC|DESC). Allowed fields: created_at, tag_id'
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *         description: 'Search by tag name (LIKE)'
 *       - in: query
 *         name: tagId
 *         schema: { type: integer }
 *         description: 'Filter by tag_id'
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date }
 *         description: 'TaskTag.created_at >= dateFrom (YYYY-MM-DD)'
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date }
 *         description: 'TaskTag.created_at <= dateTo (YYYY-MM-DD)'
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
 *                   items:
 *                     type: object
 *                     properties:
 *                       task_id: { type: integer, example: 10 }
 *                       tag_id: { type: integer, example: 3 }
 *                       created_at: { type: string, example: "2025-12-23T12:00:00.000Z" }
 *                       tag:
 *                         $ref: "#/components/schemas/Tag"
 *                 page: { type: integer, example: 1 }
 *                 size: { type: integer, example: 20 }
 *                 totalElements: { type: integer, example: 153 }
 *                 totalPages: { type: integer, example: 8 }
 *                 sort: { type: string, example: "created_at,ASC" }
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid taskId). VALIDATION_FAILED may include details.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN ( not workspace member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: RESOURCE_NOT_FOUND (project not found / task not found)
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
 *     tags: [Tags]
 *     summary: Attach tag to task
 *     description: tagId는 같은 workspace에 속해야 한다. 중복 부착(유니크키)은 STATE_CONFLICT.
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
 *             required: [tagId]
 *             properties:
 *               tagId: { type: integer, example: 3 }
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [taskTag]
 *               properties:
 *                 taskTag:
 *                   type: object
 *                   properties:
 *                     task_id: { type: integer, example: 10 }
 *                     tag_id: { type: integer, example: 3 }
 *                     created_at: { type: string, example: "2025-12-23T12:00:00.000Z" }
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid taskId / tagId required). VALIDATION_FAILED may include details.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN ( not workspace member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: RESOURCE_NOT_FOUND (project not found / task not found / tag not found in workspace)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       409:
 *         description: STATE_CONFLICT (tag already attached)
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
  .route("/projects/:projectId/tasks/:taskId/tags")
  .get(async (req, res) => {
    const ok = await loadProjectTaskOr404(req, res);
    if (!ok) return;

    const taskId = Number(req.params.taskId);

    // ✅ 1) pagination
    const { page, size, offset, limit } = parsePagination(req.query);

    // ✅ 2) sort whitelist (TaskTag 기준)
    const { sort, order } = parseSort(req.query, ["created_at", "tag_id"], "created_at,ASC");

    // ✅ 3) filters: keyword/tagId/dateFrom/dateTo
    const f = parseFilters(req.query);
    const where = { task_id: taskId };

    if (f.tagId) {
      const tid = Number(f.tagId);
      if (Number.isFinite(tid) && tid > 0) where.tag_id = tid;
    }

    if (f.dateFrom || f.dateTo) {
      where.created_at = {};
      if (f.dateFrom) where.created_at[Op.gte] = new Date(`${f.dateFrom}T00:00:00.000Z`);
      if (f.dateTo) where.created_at[Op.lte] = new Date(`${f.dateTo}T23:59:59.999Z`);
    }

    // keyword는 Tag.name에 걸어야 해서 include where 사용
    const tagWhere = {};
    if (f.keyword) tagWhere.name = { [Op.like]: `%${f.keyword}%` };

    const result = await models.TaskTag.findAndCountAll({
      where,
      include: [
        {
          model: models.Tag,
          as: "tag",
          ...(Object.keys(tagWhere).length ? { where: tagWhere } : {}),
        },
      ],
      order,
      limit,
      offset,
      distinct: true,
    });

    return sendOk(res, toPageResult(result, page, size, sort));
  })
  .post(async (req, res) => {
    const ok = await loadProjectTaskOr404(req, res);
    if (!ok) return;

    const workspaceId = req.workspace.id;
    const taskId = Number(req.params.taskId);
    const { tagId } = req.body;

    if (!tagId) return sendError(res, "BAD_REQUEST", "tagId required");

    const tag = await models.Tag.findOne({
      where: { id: tagId, workspace_id: workspaceId },
    });
    if (!tag) return sendError(res, "RESOURCE_NOT_FOUND", "tag not found in workspace");

    try {
      const row = await models.TaskTag.create({ task_id: taskId, tag_id: tagId });
      return sendOk(res, { taskTag: row });
    } catch (e) {
      // 중복 부착(유니크키) -> 상태 충돌
      return sendError(res, "STATE_CONFLICT", "tag already attached");
    }
  });

/**
 * @swagger
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}/tags/{tagId}:
 *   delete:
 *     tags: [Tags]
 *     summary: Detach tag from task
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
 *         name: tagId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204:
 *         description: No Content (detached)
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid taskId / invalid tagId). VALIDATION_FAILED may include details.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN ( not workspace member)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: RESOURCE_NOT_FOUND (project not found / task not found)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR / DATABASE_ERROR / UNKNOWN_ERROR
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router.delete("/projects/:projectId/tasks/:taskId/tags/:tagId", async (req, res) => {
  const ok = await loadProjectTaskOr404(req, res);
  if (!ok) return;

  const tagId = Number(req.params.tagId);
  if (!tagId) return sendError(res, "BAD_REQUEST", "invalid tagId");

  const taskId = Number(req.params.taskId);
  await models.TaskTag.destroy({ where: { task_id: taskId, tag_id: tagId } });
  return sendNoContent(res);
});

export default router;
