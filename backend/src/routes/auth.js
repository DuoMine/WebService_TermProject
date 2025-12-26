import express from "express";
import bcrypt from "bcrypt";
import { models } from "../models/index.js";
import { redis } from "../config/redis.js";
import { rateLimit } from "../middlewares/rateLimit.js";

import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  getAccessCookieOptions,
  getRefreshCookieOptions,
} from "../utils/jwt.js";

import { sendOk, sendError } from "../utils/http.js";

const router = express.Router();

// ✅ Sequelize models
const { User, UserRefreshToken } = models;

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 */
router.post(
  "/login",
  rateLimit({
    windowSec: 60,
    max: 5,
    keyGenerator: (req) => `rl:auth:login:${req.ip}`,
  }),
  async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, "BAD_REQUEST", "email and password required");
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return sendError(res, "UNAUTHORIZED", "invalid credentials");
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return sendError(res, "UNAUTHORIZED", "invalid credentials");
    }

    // ✅ JWT 발급
    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });

    // ✅ Redis 세션 저장 (requireSession에서 사용)
    await redis.set(`session:${user.id}`, "1");

    // ✅ Refresh token DB 저장
    await UserRefreshToken.create({
      user_id: user.id,
      token_hash: hashToken(refreshToken),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    res.cookie(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

    return sendOk(res, {
      message: "login ok",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
      },
    });
  }
);

export default router;
