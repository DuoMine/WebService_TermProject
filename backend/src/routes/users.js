import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth.js";
import { sendOk, sendError } from "../utils/http.js";
import { models } from "../models/index.js";

const router = Router();

const { User } = models;

function userPublic(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
  };
}

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User management
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get my profile
 *     security: [{ cookieAuth: [] }]
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
 *                     user:
 *                       $ref: "#/components/schemas/User"
 *               required: [ok, data]
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   patch:
 *     tags: [Users]
 *     summary: Update my profile (name)
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 2, example: "new name" }
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
 *                     user:
 *                       $ref: "#/components/schemas/User"
 *               required: [ok, data]
 *       400:
 *         description: INVALID_NAME
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: USER_NOT_FOUND
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   delete:
 *     tags: [Users]
 *     summary: Delete my account (soft delete)
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: ok (USER_DELETED)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: "USER_DELETED" }
 *               required: [ok, data]
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: USER_NOT_FOUND
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/me")
  .get(requireAuth, async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return sendError(res, 401, "UNAUTHORIZED", "missing auth");

    const u = await User.findOne({ where: { id: userId } });
    if (!u) return sendError(res, 404, "USER_NOT_FOUND", "user not found");
    return sendOk(res, { user: userPublic(u) });
  })
  .patch(requireAuth, async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return sendError(res, 401, "UNAUTHORIZED", "missing auth");

    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return sendError(res, 400, "INVALID_NAME", "name must be at least 2 chars");
    }

    const u = await User.findOne({ where: { id: userId } });
    if (!u) return sendError(res, 404, "USER_NOT_FOUND", "user not found");

    u.name = name.trim();
    await u.save();

    return sendOk(res, { user: userPublic(u) });
  })
  .delete(requireAuth, async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return sendError(res, 401, "UNAUTHORIZED", "missing auth");

    const u = await User.findOne({ where: { id: userId } });
    if (!u) return sendError(res, 404, "USER_NOT_FOUND", "user not found");

    u.status = "DELETED";
    await u.save();

    return sendOk(res, { message: "USER_DELETED" });
  });

/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create user (ADMIN only)
 *     description: role은 "ADMIN"만 인정, 그 외는 "USER"로 저장.
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name]
 *             properties:
 *               email: { type: string, example: "newuser@test.com" }
 *               name: { type: string, minLength: 2, example: "new user" }
 *               role: { type: string, enum: [USER, ADMIN], example: "USER" }
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
 *                     user:
 *                       $ref: "#/components/schemas/User"
 *               required: [ok, data]
 *       400:
 *         description: INVALID_EMAIL / INVALID_NAME
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: Forbidden (not admin)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       409:
 *         description: EMAIL_EXISTS
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   get:
 *     tags: [Users]
 *     summary: List users (ADMIN only)
 *     security: [{ cookieAuth: [] }]
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
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: "#/components/schemas/User"
 *               required: [ok, data]
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: Forbidden (not admin)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/")
  .post(requireAuth, requireAdmin, async (req, res) => {
    const { email, name, role } = req.body;

    if (!email || typeof email !== "string") {
      return sendError(res, 400, "INVALID_EMAIL", "email required");
    }
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return sendError(res, 400, "INVALID_NAME", "name must be at least 2 chars");
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) {
      return sendError(res, 409, "EMAIL_EXISTS", "email already exists");
    }

    const u = await User.create({
      email,
      name: name.trim(),
      role: role === "ADMIN" ? "ADMIN" : "USER",
      status: "ACTIVE",
    });

    return sendOk(res, { user: userPublic(u) }, 201);
  })
  .get(requireAuth, requireAdmin, async (req, res) => {
    const users = await User.findAll({
      order: [["id", "DESC"]],
    });

    return sendOk(res, {
      users: users.map(userPublic),
    });
  });

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by id (ADMIN only)
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
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
 *                     user:
 *                       $ref: "#/components/schemas/User"
 *               required: [ok, data]
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: Forbidden (not admin)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: USER_NOT_FOUND
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   patch:
 *     tags: [Users]
 *     summary: Update user by id (ADMIN only)
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: "updated name"
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
 *                 example: "USER"
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, DELETED]
 *                 example: "ACTIVE"
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
 *                     user:
 *                       $ref: "#/components/schemas/User"
 *               required: [ok, data]
 *       400:
 *         description: INVALID_NAME / INVALID_ROLE / INVALID_STATUS
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: Forbidden (not admin)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: USER_NOT_FOUND
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   delete:
 *     tags: [Users]
 *     summary: Delete user by id (ADMIN only, soft delete)
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ok (USER_DELETED)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: "USER_DELETED" }
 *               required: [ok, data]
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: Forbidden (not admin)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       404:
 *         description: USER_NOT_FOUND
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/:id")
  .get(requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;

    const u = await User.findOne({ where: { id } });
    if (!u) return sendError(res, 404, "USER_NOT_FOUND", "user not found");

    return sendOk(res, { user: userPublic(u) });
  })
  .patch(requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, role, status } = req.body;

    const u = await User.findOne({ where: { id } });
    if (!u) return sendError(res, 404, "USER_NOT_FOUND", "user not found");

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return sendError(res, 400, "INVALID_NAME", "name must be at least 2 chars");
      }
      u.name = name.trim();
    }

    if (role !== undefined) {
      if (!["USER", "ADMIN"].includes(role)) {
        return sendError(res, 400, "INVALID_ROLE", "invalid role");
      }
      u.role = role;
    }

    if (status !== undefined) {
      if (!["ACTIVE", "INACTIVE", "DELETED"].includes(status)) {
        return sendError(res, 400, "INVALID_STATUS", "invalid status");
      }
      u.status = status;
    }

    await u.save();
    return sendOk(res, { user: userPublic(u) });
  })
  .delete(requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;

    const u = await User.findOne({ where: { id } });
    if (!u) return sendError(res, 404, "USER_NOT_FOUND", "user not found");

    u.status = "DELETED";
    await u.save();

    return sendOk(res, { message: "USER_DELETED" });
  });

export default router;
