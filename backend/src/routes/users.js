import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth.js";
import { rateLimit } from "../middlewares/rateLimit.js";
import { sendOk, sendError, sendCreated, sendNoContent } from "../utils/http.js";
import { models } from "../models/index.js";
import { Op } from "sequelize";
import { parsePagination, parseSort, parseFilters, toPageResult } from "../utils/listQuery.js";

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
 *               required: [user]
 *               properties:
 *                 user:
 *                   $ref: "#/components/schemas/User"
 *       401:
 *         description: UNAUTHORIZED ( requireAuth)
 *       404:
 *         description: USER_NOT_FOUND
 *       500:
 *         description: INTERNAL_SERVER_ERROR / DATABASE_ERROR / UNKNOWN_ERROR
 *
 *   patch:
 *     tags: [Users]
 *     summary: Update my profile (name)
 *     security: [{ cookieAuth: [] }]
 *
 *   delete:
 *     tags: [Users]
 *     summary: Delete my account (soft delete)
 *     security: [{ cookieAuth: [] }]
 */
router
  .route("/me")
  .get(requireAuth, async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return sendError(res, "UNAUTHORIZED", "missing auth");

    const u = await User.findOne({ where: { id: userId } });
    if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

    return sendOk(res, { user: userPublic(u) });
  })
  .patch(
    requireAuth,
    rateLimit({
      windowSec: 60,
      max: 30,
      keyGenerator: (req) => `rl:users:me:patch:${req.auth.userId}`,
    }),
    async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) return sendError(res, "UNAUTHORIZED", "missing auth");

      const { name } = req.body;

      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return sendError(res, "VALIDATION_FAILED", "validation failed", {
          name: "must be at least 2 chars",
        });
      }

      const u = await User.findOne({ where: { id: userId } });
      if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

      u.name = name.trim();
      await u.save();

      return sendOk(res, { user: userPublic(u) });
    }
  )
  .delete(
    requireAuth,
    rateLimit({
      windowSec: 60,
      max: 20,
      keyGenerator: (req) => `rl:users:me:delete:${req.auth.userId}`,
    }),
    async (req, res) => {
      const userId = req.auth?.userId;
      if (!userId) return sendError(res, "UNAUTHORIZED", "missing auth");

      const u = await User.findOne({ where: { id: userId } });
      if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

      u.status = "DELETED";
      await u.save();

      return sendNoContent(res);
    }
  );

/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create user (ADMIN only)
 *   get:
 *     tags: [Users]
 *     summary: List users (ADMIN only)
 */
router
  .route("/")
  .post(
    requireAuth,
    requireAdmin,
    rateLimit({
      windowSec: 60,
      max: 20,
      keyGenerator: (req) => `rl:users:create:${req.auth.userId}`,
    }),
    async (req, res) => {
      const { email, name, role } = req.body;

      if (!email || typeof email !== "string") {
        return sendError(res, "VALIDATION_FAILED", "validation failed", { email: "required" });
      }
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return sendError(res, "VALIDATION_FAILED", "validation failed", {
          name: "must be at least 2 chars",
        });
      }

      const exists = await User.findOne({ where: { email } });
      if (exists) {
        return sendError(res, "DUPLICATE_RESOURCE", "email already exists");
      }

      const u = await User.create({
        email,
        name: name.trim(),
        role: role === "ADMIN" ? "ADMIN" : "USER",
        status: "ACTIVE",
      });

      return sendCreated(res, { user: userPublic(u) });
    }
  )
  .get(requireAuth, requireAdmin, async (req, res) => {
    const { page, size, offset, limit } = parsePagination(req.query);
    const { sort, order } = parseSort(
      req.query,
      ["id", "created_at", "updated_at", "email", "name", "role", "status"],
      "created_at,DESC"
    );

    const f = parseFilters(req.query);
    const where = { status: { [Op.ne]: "DELETED" } };

    if (f.role) where.role = f.role;
    if (f.status && ["ACTIVE", "SUSPENDED"].includes(f.status)) {
      where.status = f.status;
    }
    if (f.keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${f.keyword}%` } },
        { email: { [Op.like]: `%${f.keyword}%` } },
      ];
    }

    const result = await User.findAndCountAll({
      where,
      order,
      limit,
      offset,
    });

    return sendOk(
      res,
      toPageResult({ rows: result.rows.map(userPublic), count: result.count }, page, size, sort)
    );
  });

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by id (ADMIN only)
 *   patch:
 *     tags: [Users]
 *     summary: Update user by id (ADMIN only)
 *   delete:
 *     tags: [Users]
 *     summary: Delete user by id (ADMIN only, soft delete)
 */
router
  .route("/:id")
  .get(requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;

    const u = await User.findOne({ where: { id } });
    if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

    return sendOk(res, { user: userPublic(u) });
  })
  .patch(
    requireAuth,
    requireAdmin,
    rateLimit({
      windowSec: 60,
      max: 30,
      keyGenerator: (req) => `rl:users:update:${req.auth.userId}`,
    }),
    async (req, res) => {
      const { id } = req.params;
      const { name, role, status } = req.body;

      const u = await User.findOne({ where: { id } });
      if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

      if (name !== undefined) {
        if (typeof name !== "string" || name.trim().length < 2) {
          return sendError(res, "VALIDATION_FAILED", "validation failed", {
            name: "must be at least 2 chars",
          });
        }
        u.name = name.trim();
      }

      if (role !== undefined) {
        if (!["USER", "ADMIN"].includes(role)) {
          return sendError(res, "VALIDATION_FAILED", "validation failed", { role: "invalid role" });
        }
        u.role = role;
      }

      if (status !== undefined) {
        if (!["ACTIVE", "SUSPENDED", "DELETED"].includes(status)) {
          return sendError(res, "VALIDATION_FAILED", "validation failed", {
            status: "invalid status",
          });
        }
        u.status = status;
      }

      await u.save();
      return sendOk(res, { user: userPublic(u) });
    }
  )
  .delete(
    requireAuth,
    requireAdmin,
    rateLimit({
      windowSec: 60,
      max: 20,
      keyGenerator: (req) => `rl:users:delete:${req.auth.userId}`,
    }),
    async (req, res) => {
      const { id } = req.params;

      const u = await User.findOne({ where: { id } });
      if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

      u.status = "DELETED";
      await u.save();

      return sendNoContent(res);
    }
  );

export default router;
