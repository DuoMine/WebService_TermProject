// src/routes/tasks.js
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

const VALID_STATUS = ["TODO", "DOING", "DONE"];
const VALID_PRIORITY = ["LOW", "MEDIUM", "HIGH"];

async function loadProjectOr404(req, res) {
  const workspaceId = req.workspace.id;
  const projectId = Number(req.params.projectId);

  if (!projectId) {
    sendError(res, "BAD_REQUEST", "invalid projectId");
    return null;
  }

  const project = await models.Project.findOne({
    where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
  });

  if (!project) {
    sendError(res, "RESOURCE_NOT_FOUND", "project not found");
    return null;
  }

  return project;
}

/**
 * @swagger
 * tags:
 *   - name: Tasks
 *     description: Task management
 */

/**
 * @swagger
 * /workspaces/{workspaceId}/projects/{projectId}/tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks in project
 *     description: 'deleted_at=null만 반환. Pagination(1-base) + sort + filters(keyword,status,assigneeId,dueFrom/dueTo). Allowed sort fields: id, created_at, due_at, status, priority'
 *     security: [{ cookieAuth: [] }]
 *   post:
 *     tags: [Tasks]
 *     summary: Create task
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: projectId
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
 *         description: 'Sort format: field,(ASC|DESC). Allowed fields: id, created_at, due_at, status, priority'
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *         description: 'Search by title/description (LIKE)'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [TODO, DOING, DONE] }
 *         description: 'Filter by task status'
 *       - in: query
 *         name: assigneeId
 *         schema: { type: integer }
 *         description: 'Filter by assignee_id'
 *       - in: query
 *         name: dueFrom
 *         schema: { type: string, format: date }
 *         description: 'due_at >= dueFrom (YYYY-MM-DD)'
 *       - in: query
 *         name: dueTo
 *         schema: { type: string, format: date }
 *         description: 'due_at <= dueTo (YYYY-MM-DD)'
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
 *                     $ref: "#/components/schemas/Task"
 *                 page: { type: integer, example: 1 }
 *                 size: { type: integer, example: 20 }
 *                 totalElements: { type: integer, example: 153 }
 *                 totalPages: { type: integer, example: 8 }
 *                 sort: { type: string, example: "created_at,DESC" }
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

 *   post:
 *     tags: [Tasks]
 *     summary: Create task
 *     description: status/priority는 지정하지 않으면 TODO/MEDIUM으로 저장.
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
 *             required: [title]
 *             properties:
 *               title: { type: string, example: "Implement swagger docs" }
 *               description: { type: string, nullable: true, example: "..." }
 *               status: { type: string, enum: [TODO, DOING, DONE], example: "TODO" }
 *               priority: { type: string, enum: [LOW, MEDIUM, HIGH], example: "MEDIUM" }
 *               dueAt: { type: string, nullable: true, example: "2025-12-26T12:00:00.000Z" }
 *               assigneeId: { type: integer, nullable: true, example: 2 }
 *     responses:
 *       201:
 *         description: created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [task]
 *               properties:
 *                 task:
 *                   $ref: "#/components/schemas/Task"
 *       400:
 *         description: BAD_REQUEST (invalid projectId / title required / invalid status / invalid priority). VALIDATION_FAILED may include details.
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
  .route("/")
  .get(async (req, res) => {
    const project = await loadProjectOr404(req, res);
    if (!project) return;

    const projectId = Number(req.params.projectId);

    const { page, size, offset, limit } = parsePagination(req.query);

    const { sort, order } = parseSort(
      req.query,
      ["id", "created_at", "due_at", "status", "priority"],
      "created_at,DESC"
    );

    const f = parseFilters(req.query);
    const where = { project_id: projectId, deleted_at: null };

    if (f.keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${f.keyword}%` } },
        { description: { [Op.like]: `%${f.keyword}%` } },
      ];
    }

    if (f.status && VALID_STATUS.includes(f.status)) {
      where.status = f.status;
    }

    if (f.assigneeId) {
      const aid = Number(f.assigneeId);
      if (Number.isFinite(aid) && aid > 0) where.assignee_id = aid;
    }

    if (f.dueFrom || f.dueTo) {
      where.due_at = {};
      if (f.dueFrom) where.due_at[Op.gte] = new Date(`${f.dueFrom}T00:00:00.000Z`);
      if (f.dueTo) where.due_at[Op.lte] = new Date(`${f.dueTo}T23:59:59.999Z`);
    }

    const result = await models.Task.findAndCountAll({
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
        `rl:tasks:create:${req.auth.userId}:${req.params.projectId}`,
    }),
    async (req, res) => {
      const project = await loadProjectOr404(req, res);
      if (!project) return;

      const projectId = Number(req.params.projectId);
      const userId = req.auth.userId;

      const { title, description, status, priority, dueAt, assigneeId } = req.body;
      if (!title) return sendError(res, "BAD_REQUEST", "title required");

      if (status !== undefined && !VALID_STATUS.includes(status)) {
        return sendError(res, "BAD_REQUEST", "invalid status");
      }
      if (priority !== undefined && !VALID_PRIORITY.includes(priority)) {
        return sendError(res, "BAD_REQUEST", "invalid priority");
      }

      const task = await models.Task.create({
        project_id: projectId,
        title,
        description: description ?? null,
        status: status ?? "TODO",
        priority: priority ?? "MEDIUM",
        due_at: dueAt ?? null,
        created_by: userId,
        assignee_id: assigneeId ?? null,
      });

      return sendCreated(res, { task });
    }
  );

/**
 * @swagger
 * /workspaces/{workspaceId}/projects/{projectId}/tasks/{taskId}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get task detail
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
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [task]
 *               properties:
 *                 task:
 *                   $ref: "#/components/schemas/Task"
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
 *   patch:
 *     tags: [Tasks]
 *     summary: Update task
 *     description: status는 TODO/DOING/DONE, priority는 LOW/MEDIUM/HIGH만 허용.
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
 *             properties:
 *               title: { type: string, example: "Updated title" }
 *               description: { type: string, nullable: true, example: "..." }
 *               status: { type: string, enum: [TODO, DOING, DONE], example: "DOING" }
 *               priority: { type: string, enum: [LOW, MEDIUM, HIGH], example: "HIGH" }
 *               dueAt: { type: string, nullable: true, example: "2025-12-26T12:00:00.000Z" }
 *               assigneeId: { type: integer, nullable: true, example: 3 }
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [task]
 *               properties:
 *                 task:
 *                   $ref: "#/components/schemas/Task"
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid taskId / invalid status / invalid priority). VALIDATION_FAILED may include details.
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
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete task (soft delete)
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
 *     responses:
 *       204:
 *         description: No Content (soft deleted)
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
 */
router
  .route("/:taskId")
  .get(async (req, res) => {
    const project = await loadProjectOr404(req, res);
    if (!project) return;

    const projectId = Number(req.params.projectId);
    const taskId = Number(req.params.taskId);
    if (!taskId) return sendError(res, "BAD_REQUEST", "invalid taskId");

    const task = await models.Task.findOne({
      where: { id: taskId, project_id: projectId, deleted_at: null },
    });
    if (!task) return sendError(res, "RESOURCE_NOT_FOUND", "task not found");

    return sendOk(res, { task });
  })
  .patch(
    rateLimit({
      windowSec: 60,
      max: 30,
      keyGenerator: (req) =>
        `rl:tasks:update:${req.auth.userId}:${req.params.taskId}`,
    }),
    async (req, res) => {
      const project = await loadProjectOr404(req, res);
      if (!project) return;

      const projectId = Number(req.params.projectId);
      const taskId = Number(req.params.taskId);
      if (!taskId) return sendError(res, "BAD_REQUEST", "invalid taskId");

      const task = await models.Task.findOne({
        where: { id: taskId, project_id: projectId, deleted_at: null },
      });
      if (!task) return sendError(res, "RESOURCE_NOT_FOUND", "task not found");

      const { title, description, status, priority, dueAt, assigneeId } = req.body;

      if (status !== undefined && !VALID_STATUS.includes(status)) {
        return sendError(res, "BAD_REQUEST", "invalid status");
      }
      if (priority !== undefined && !VALID_PRIORITY.includes(priority)) {
        return sendError(res, "BAD_REQUEST", "invalid priority");
      }

      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (status !== undefined) task.status = status;
      if (priority !== undefined) task.priority = priority;
      if (dueAt !== undefined) task.due_at = dueAt;
      if (assigneeId !== undefined) task.assignee_id = assigneeId;

      await task.save();
      return sendOk(res, { task });
    }
  )
  .delete(
    rateLimit({
      windowSec: 60,
      max: 20,
      keyGenerator: (req) =>
        `rl:tasks:delete:${req.auth.userId}:${req.params.taskId}`,
    }),
    async (req, res) => {
      const project = await loadProjectOr404(req, res);
      if (!project) return;

      const projectId = Number(req.params.projectId);
      const taskId = Number(req.params.taskId);
      if (!taskId) return sendError(res, "BAD_REQUEST", "invalid taskId");

      const task = await models.Task.findOne({
        where: { id: taskId, project_id: projectId, deleted_at: null },
      });
      if (!task) return sendError(res, "RESOURCE_NOT_FOUND", "task not found");

      task.deleted_at = new Date();
      await task.save();

      return sendNoContent(res);
    }
  );

export default router;
