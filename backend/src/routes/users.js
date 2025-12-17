import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
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

export default router;
