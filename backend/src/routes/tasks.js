// src/routes/tasks.js
import express from "express";
import { models } from "../models/index.js";
import { sendOk, sendError } from "../utils/http.js";

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
    sendError(res, 400, "BAD_REQUEST", "invalid projectId");
    return null;
  }

  const project = await models.Project.findOne({
    where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
  });

  if (!project) {
    sendError(res, 404, "NOT_FOUND", "project not found");
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
 *     description: project 존재/권한은 상위 미들웨어(+loadProjectOr404)로 검증. deleted_at=null만 반환.
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
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/Task"
 *               required: [ok, data]
 *       400:
 *         description: BAD_REQUEST (invalid projectId)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: NOT_FOUND (project not found)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
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
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     task:
 *                       $ref: "#/components/schemas/Task"
 *               required: [ok, data]
 *       400:
 *         description: BAD_REQUEST (invalid projectId / title required / invalid status / invalid priority)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: NOT_FOUND (project not found)
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

    const tasks = await models.Task.findAll({
      where: { project_id: projectId, deleted_at: null },
      order: [["created_at", "DESC"]],
    });

    return sendOk(res, { tasks });
  })
  .post(async (req, res) => {
    const project = await loadProjectOr404(req, res);
    if (!project) return;

    const projectId = Number(req.params.projectId);
    const userId = req.auth.userId;

    const { title, description, status, priority, dueAt, assigneeId } = req.body;
    if (!title) return sendError(res, 400, "BAD_REQUEST", "title required");

    if (status !== undefined && !VALID_STATUS.includes(status)) {
      return sendError(res, 400, "BAD_REQUEST", "invalid status");
    }
    if (priority !== undefined && !VALID_PRIORITY.includes(priority)) {
      return sendError(res, 400, "BAD_REQUEST", "invalid priority");
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

    return sendOk(res, { task }, 201);
  });

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
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     task:
 *                       $ref: "#/components/schemas/Task"
 *               required: [ok, data]
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
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     task:
 *                       $ref: "#/components/schemas/Task"
 *               required: [ok, data]
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid taskId / invalid status / invalid priority)
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
 *       200:
 *         description: ok
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
 */
router
  .route("/:taskId")
  .get(async (req, res) => {
    const project = await loadProjectOr404(req, res);
    if (!project) return;

    const projectId = Number(req.params.projectId);
    const taskId = Number(req.params.taskId);
    if (!taskId) return sendError(res, 400, "BAD_REQUEST", "invalid taskId");

    const task = await models.Task.findOne({
      where: { id: taskId, project_id: projectId, deleted_at: null },
    });
    if (!task) return sendError(res, 404, "NOT_FOUND", "task not found");

    return sendOk(res, { task });
  })
  .patch(async (req, res) => {
    const project = await loadProjectOr404(req, res);
    if (!project) return;

    const projectId = Number(req.params.projectId);
    const taskId = Number(req.params.taskId);
    if (!taskId) return sendError(res, 400, "BAD_REQUEST", "invalid taskId");

    const task = await models.Task.findOne({
      where: { id: taskId, project_id: projectId, deleted_at: null },
    });
    if (!task) return sendError(res, 404, "NOT_FOUND", "task not found");

    const { title, description, status, priority, dueAt, assigneeId } = req.body;

    if (status !== undefined && !VALID_STATUS.includes(status)) {
      return sendError(res, 400, "BAD_REQUEST", "invalid status");
    }
    if (priority !== undefined && !VALID_PRIORITY.includes(priority)) {
      return sendError(res, 400, "BAD_REQUEST", "invalid priority");
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (dueAt !== undefined) task.due_at = dueAt;
    if (assigneeId !== undefined) task.assignee_id = assigneeId;

    await task.save();
    return sendOk(res, { task });
  })
  .delete(async (req, res) => {
    const project = await loadProjectOr404(req, res);
    if (!project) return;

    const projectId = Number(req.params.projectId);
    const taskId = Number(req.params.taskId);
    if (!taskId) return sendError(res, 400, "BAD_REQUEST", "invalid taskId");

    const task = await models.Task.findOne({
      where: { id: taskId, project_id: projectId, deleted_at: null },
    });
    if (!task) return sendError(res, 404, "NOT_FOUND", "task not found");

    task.deleted_at = new Date();
    await task.save();

    return sendOk(res);
  });

export default router;
