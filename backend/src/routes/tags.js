// src/routes/tags.js
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
 * => req.workspace 존재
 */

// 공통: project/task 스코프 확인
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
 *                     tags:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/Tag"
 *               required: [ok, data]
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
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
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tag:
 *                       $ref: "#/components/schemas/Tag"
 *               required: [ok, data]
 *       400:
 *         description: BAD_REQUEST (name required / invalid workspace_id / invalid tag data)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       409:
 *         description: CONFLICT (tag already exists)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_ERROR (failed to create tag)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/tags")
  .get(async (req, res) => {
    const workspaceId = req.workspace.id;

    const tags = await models.Tag.findAll({
      where: { workspace_id: workspaceId },
      order: [["name", "ASC"]],
    });

    return sendOk(res, { tags });
  })
  .post(async (req, res) => {
    const workspaceId = req.workspace.id;
    const { name } = req.body;

    if (!name) return sendError(res, 400, "BAD_REQUEST", "name required");

    try {
      const tag = await models.Tag.create({ workspace_id: workspaceId, name });
      return sendOk(res, { tag }, 201);
    } catch (e) {
      console.error(
        "[POST /tags] create failed:",
        e?.name,
        e?.message,
        e?.original?.code,
        e?.original?.errno
      );

      if (e?.name === "SequelizeUniqueConstraintError") {
        return sendError(res, 409, "CONFLICT", "tag already exists");
      }

      if (e?.name === "SequelizeForeignKeyConstraintError") {
        return sendError(res, 400, "BAD_REQUEST", "invalid workspace_id");
      }
      if (e?.name === "SequelizeValidationError") {
        return sendError(res, 400, "BAD_REQUEST", "invalid tag data");
      }

      return sendError(res, 500, "INTERNAL_ERROR", "failed to create tag");
    }
  });

/**
 * @swagger
 * /workspaces/{workspaceId}/tags/{tagId}:
 *   delete:
 *     tags: [Tags]
 *     summary: Delete workspace tag
 *     description: 물리 삭제(destroy). tagId가 workspace에 속하지 않으면 NOT_FOUND.
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
 *       200:
 *         description: ok
 *       400:
 *         description: BAD_REQUEST (invalid tagId)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: NOT_FOUND (tag not found)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router.delete("/tags/:tagId", async (req, res) => {
  const workspaceId = req.workspace.id;
  const tagId = Number(req.params.tagId);

  if (!tagId) return sendError(res, 400, "BAD_REQUEST", "invalid tagId");

  const tag = await models.Tag.findOne({
    where: { id: tagId, workspace_id: workspaceId },
  });
  if (!tag) return sendError(res, 404, "NOT_FOUND", "tag not found");

  await tag.destroy();
  return sendOk(res);
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
 *     description: TaskTag 목록(필요시 include로 Tag 포함). created_at ASC.
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
 *                     taskTags:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           task_id: { type: integer, example: 10 }
 *                           tag_id: { type: integer, example: 3 }
 *                           created_at: { type: string, example: "2025-12-23T12:00:00.000Z" }
 *                           tag:
 *                             $ref: "#/components/schemas/Tag"
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
 *   post:
 *     tags: [Tags]
 *     summary: Attach tag to task
 *     description: tagId는 같은 workspace에 속해야 한다. 중복 부착은 CONFLICT.
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
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     taskTag:
 *                       type: object
 *                       properties:
 *                         task_id: { type: integer, example: 10 }
 *                         tag_id: { type: integer, example: 3 }
 *                         created_at: { type: string, example: "2025-12-23T12:00:00.000Z" }
 *               required: [ok, data]
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid taskId / tagId required)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: NOT_FOUND (project not found / task not found / tag not found in workspace)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       409:
 *         description: CONFLICT (tag already attached)
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

    const rows = await models.TaskTag.findAll({
      where: { task_id: taskId },
      include: [{ model: models.Tag, as: "tag" }],
      order: [["created_at", "ASC"]],
    });

    return sendOk(res, { taskTags: rows });
  })
  .post(async (req, res) => {
    const ok = await loadProjectTaskOr404(req, res);
    if (!ok) return;

    const workspaceId = req.workspace.id;
    const taskId = Number(req.params.taskId);
    const { tagId } = req.body;

    if (!tagId) return sendError(res, 400, "BAD_REQUEST", "tagId required");

    const tag = await models.Tag.findOne({
      where: { id: tagId, workspace_id: workspaceId },
    });
    if (!tag) return sendError(res, 404, "NOT_FOUND", "tag not found in workspace");

    try {
      const row = await models.TaskTag.create({ task_id: taskId, tag_id: tagId });
      return sendOk(res, { taskTag: row });
    } catch (e) {
      return sendError(res, 409, "CONFLICT", "tag already attached");
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
 *       200:
 *         description: ok
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid taskId / invalid tagId)
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
router.delete("/projects/:projectId/tasks/:taskId/tags/:tagId", async (req, res) => {
  const ok = await loadProjectTaskOr404(req, res);
  if (!ok) return;

  const tagId = Number(req.params.tagId);
  if (!tagId) return sendError(res, 400, "BAD_REQUEST", "invalid tagId");

  const taskId = Number(req.params.taskId);
  await models.TaskTag.destroy({ where: { task_id: taskId, tag_id: tagId } });
  return sendOk(res);
});

export default router;
