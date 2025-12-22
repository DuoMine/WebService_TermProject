// src/routes/projects.js
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
 *     description: deleted_at=null인 프로젝트만 반환한다.
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
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/Project"
 *               required: [ok, data]
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
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
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: "#/components/schemas/Project"
 *               required: [ok, data]
 *       400:
 *         description: BAD_REQUEST (name required)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED / not member (middleware)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/")
  .get(async (req, res) => {
    const workspaceId = req.workspace.id;

    const projects = await models.Project.findAll({
      where: { workspace_id: workspaceId, deleted_at: null },
      order: [["created_at", "DESC"]],
    });

    return sendOk(res, { projects });
  })
  .post(async (req, res) => {
    const workspaceId = req.workspace.id;
    const userId = req.auth.userId;
    const { name, description } = req.body;

    if (!name) return sendError(res, 400, "BAD_REQUEST", "name required");

    const p = await models.Project.create({
      workspace_id: workspaceId,
      name,
      description: description ?? null,
      status: "ACTIVE",
      created_by: userId,
    });

    return sendOk(res, { project: p }, 201);
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
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: "#/components/schemas/Project"
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
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       $ref: "#/components/schemas/Project"
 *               required: [ok, data]
 *       400:
 *         description: BAD_REQUEST (invalid projectId / invalid status)
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
 *       200:
 *         description: ok
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
 */
router
  .route("/:projectId")
  .get(async (req, res) => {
    const workspaceId = req.workspace.id;
    const projectId = Number(req.params.projectId);
    if (!projectId) return sendError(res, 400, "BAD_REQUEST", "invalid projectId");

    const p = await models.Project.findOne({
      where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
    });
    if (!p) return sendError(res, 404, "NOT_FOUND", "project not found");

    return sendOk(res, { project: p });
  })
  .patch(async (req, res) => {
    const workspaceId = req.workspace.id;
    const projectId = Number(req.params.projectId);
    if (!projectId) return sendError(res, 400, "BAD_REQUEST", "invalid projectId");

    const p = await models.Project.findOne({
      where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
    });
    if (!p) return sendError(res, 404, "NOT_FOUND", "project not found");

    const { name, description, status } = req.body;

    if (name !== undefined) p.name = name;
    if (description !== undefined) p.description = description;

    if (status !== undefined) {
      if (!["ACTIVE", "ARCHIVED"].includes(status)) {
        return sendError(res, 400, "BAD_REQUEST", "invalid status");
      }
      p.status = status;
    }

    await p.save();
    return sendOk(res, { project: p });
  })
  .delete(async (req, res) => {
    const workspaceId = req.workspace.id;
    const projectId = Number(req.params.projectId);
    if (!projectId) return sendError(res, 400, "BAD_REQUEST", "invalid projectId");

    const p = await models.Project.findOne({
      where: { id: projectId, workspace_id: workspaceId, deleted_at: null },
    });
    if (!p) return sendError(res, 404, "NOT_FOUND", "project not found");

    p.deleted_at = new Date();
    await p.save();

    return sendOk(res);
  });

export default router;
