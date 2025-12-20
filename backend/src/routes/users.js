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
 * POST /api/users
 * - ADMIN only
 */
router.post("/", requireAuth, requireAdmin, async (req, res) => {
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

  return sendOk(res, { user: userPublic(u) });
});

/**
 * GET /api/users
 * - ADMIN only
 */
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const users = await User.findAll({
    order: [["id", "DESC"]],
  });

  return sendOk(res, {
    users: users.map(userPublic),
  });
});

/**
 * GET /api/users/:id
 * - ADMIN only
 */
router.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const u = await User.findOne({ where: { id } });
  if (!u) return sendError(res, 404, "USER_NOT_FOUND", "user not found");

  return sendOk(res, { user: userPublic(u) });
});

/**
 * PATCH /api/users/:id
 * - ADMIN only
 */
router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
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
});

/**
 * DELETE /api/users/:id
 * - ADMIN only
 */
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const u = await User.findOne({ where: { id } });
  if (!u) return sendError(res, 404, "USER_NOT_FOUND", "user not found");

  u.status = "DELETED";
  await u.save();

  return sendOk(res, { message: "USER_DELETED" });
});

// users/me

/**
 * GET /api/users/me
 * - access token 필요
 */
router.get("/me", requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) return sendError(res, 401, "UNAUTHORIZED", "missing auth");

  const u = await User.findOne({ where: { id: userId } });
  if (!u) return sendError(res, 404, "USER_NOT_FOUND", "user not found");
  return sendOk(res, { user: userPublic(u) });
});

/**
 * PATCH /api/users/me
 * - access token 필요
 * - name 수정
 */
router.patch("/me", requireAuth, async (req, res) => {
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
});

/**
 * DELETE /api/users/me
 * - access token 필요
 */
router.delete("/me", requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) return sendError(res, 401, "UNAUTHORIZED", "missing auth");

  const u = await User.findOne({ where: { id: userId } });
  if (!u) return sendError(res, 404, "USER_NOT_FOUND", "user not found");

  u.status = "DELETED";
  await u.save();

  return sendOk(res, { message: "USER_DELETED" });
});

export default router;
