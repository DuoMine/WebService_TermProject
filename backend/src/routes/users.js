import { Router } from "express";
import { requireAuth, requireAdmin } from "../middlewares/requireAuth.js";
import { sendOk, sendError, sendCreated } from "../utils/http.js";
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
 *         description: VALIDATION_FAILED
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
    if (!userId) return sendError(res, "UNAUTHORIZED", "missing auth");

    const u = await User.findOne({ where: { id: userId } });
    if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

    return sendOk(res, { user: userPublic(u) });
  })
  .patch(requireAuth, async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return sendError(res, "UNAUTHORIZED", "missing auth");

    const { name } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return sendError(res, "VALIDATION_FAILED", "validation failed", { name: "must be at least 2 chars" });
    }

    const u = await User.findOne({ where: { id: userId } });
    if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

    u.name = name.trim();
    await u.save();

    return sendOk(res, { user: userPublic(u) });
  })
  .delete(requireAuth, async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) return sendError(res, "UNAUTHORIZED", "missing auth");

    const u = await User.findOne({ where: { id: userId } });
    if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

    u.status = "DELETED";
    await u.save();

    return sendNoContent(res);
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
 *         description: VALIDATION_FAILED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       409:
 *         description: DUPLICATE_RESOURCE
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *
 *   get:
 *     tags: [Users]
 *     summary: List users (ADMIN only)
 *     description: 'Pagination(1-base) + sort + filters(keyword/role/status). 기본은 DELETED 제외.'
 *     security: [{ cookieAuth: [] }]
 *     parameters:
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
 *         description: 'Sort format: field,(ASC|DESC). Allowed fields: id, created_at, updated_at, email, name, role, status'
 *       - in: query
 *         name: keyword
 *         schema: { type: string }
 *         description: 'Search by name or email (LIKE)'
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [USER, ADMIN] }
 *         description: 'Filter by role'
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, SUSPENDED] }
 *         description: 'Filter by status (DELETED is excluded by default)'
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
 *                     $ref: "#/components/schemas/User"
 *                 page: { type: integer, example: 1 }
 *                 size: { type: integer, example: 20 }
 *                 totalElements: { type: integer, example: 153 }
 *                 totalPages: { type: integer, example: 8 }
 *                 sort: { type: string, example: "created_at,DESC" }
 *               required: [content, page, size, totalElements, totalPages]
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router
  .route("/")
  .post(requireAuth, requireAdmin, async (req, res) => {
    const { email, name, role } = req.body;

    if (!email || typeof email !== "string") {
      return sendError(res, "VALIDATION_FAILED", "validation failed", { email: "required" });
    }
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return sendError(res, "VALIDATION_FAILED", "validation failed", { name: "must be at least 2 chars" });
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
  })
  .get(requireAuth, requireAdmin, async (req, res) => {
    // 1) pagination (1-base)
    const { page, size, offset, limit } = parsePagination(req.query);

    // 2) sort whitelist (DB 컬럼명 기준)
    const { sort, order } = parseSort(
      req.query,
      ["id", "created_at", "updated_at", "email", "name", "role", "status"],
      "created_at,DESC"
    );

    // 3) filters
    const f = parseFilters(req.query);

    // ✅ 기본: DELETED 제외
    const where = { status: { [Op.ne]: "DELETED" } };

    if (f.role) where.role = f.role;

    // status는 ACTIVE/SUSPENDED만 허용(그 외 값은 무시)
    if (f.status && ["ACTIVE", "SUSPENDED"].includes(f.status)) {
      where.status = f.status;
    }

    if (f.keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${f.keyword}%` } },
        { email: { [Op.like]: `%${f.keyword}%` } },
      ];
    }

    // 4) query
    const result = await User.findAndCountAll({
      where,
      order,
      limit,
      offset,
    });

    // 5) response: 과제 포맷 그대로(래핑 없이)
    return sendOk(res, toPageResult({ rows: result.rows.map(userPublic), count: result.count }, page, size, sort)
    );
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
 *         description: FORBIDDEN
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
 *                 enum: [ACTIVE, SUSPENDED, DELETED]
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
 *         description: VALIDATION_FAILED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN
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
 *         description: FORBIDDEN
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
    if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

    return sendOk(res, { user: userPublic(u) });
  })
  .patch(requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, role, status } = req.body;

    const u = await User.findOne({ where: { id } });
    if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return sendError(res, "VALIDATION_FAILED", "validation failed", { name: "must be at least 2 chars" });
      }
      u.name = name.trim();
    }

    if (role !== undefined) {
      if (!["USER", "ADMIN"].includes(role)) {
        return sendError(res, "VALIDATION_FAILED", "validation failed", { role: "invalid role"});
      }
      u.role = role;
    }

    if (status !== undefined) {
      if (!["ACTIVE", "SUSPENDED", "DELETED"].includes(status)) {
        return sendError(res, "VALIDATION_FAILED", "validation failed", {status: "invalid status"});
      }
      u.status = status;
    }

    await u.save();
    return sendOk(res, { user: userPublic(u) });
  })
  .delete(requireAuth, requireAdmin, async (req, res) => {
    const { id } = req.params;

    const u = await User.findOne({ where: { id } });
    if (!u) return sendError(res, "USER_NOT_FOUND", "user not found");

    u.status = "DELETED";
    await u.save();

    return sendNoContent(res);
  });

export default router;
