import express from "express";
import bcrypt from "bcrypt";
import { models } from "../models/index.js";
import { redis } from "../config/redis.js";
import { rateLimit } from "../middlewares/rateLimit.js";

import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  getAccessCookieOptions,
  getRefreshCookieOptions,
} from "../utils/jwt.js";

import { sendOk, sendError } from "../utils/http.js";

const router = express.Router();
const { User, UserRefreshToken } = models;

const isTest = process.env.NODE_ENV === "test";

/**
 * =========================
 * Swagger: Auth Tag
 * =========================
 */
/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication (cookie-based access/refresh)
 */

/**
 * =========================
 * POST /api/auth/signup
 * =========================
 */
/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Sign up
 *     description: Create local account (email/password)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user1@test.com
 *               password:
 *                 type: string
 *                 example: password1234
 *               name:
 *                 type: string
 *                 example: user1
 *     responses:
 *       201:
 *         description: created
 *       400:
 *         description: VALIDATION_FAILED
 *       409:
 *         description: DUPLICATE_RESOURCE
 */
router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body ?? {};

  if (!email || !password || !name) {
    return sendError(res, "BAD_REQUEST", "email, password, name required");
  }

  const exists = await User.findOne({ where: { email } });
  if (exists) {
    return sendError(res, "DUPLICATE_RESOURCE", "email already exists");
  }

  const password_hash = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    password_hash,
    name,
    role: "USER",
    status: "ACTIVE",
  });

  return res.status(201).json({
    message: "signup ok",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
    },
  });
});

/**
 * =========================
 * POST /api/auth/login
 * =========================
 */
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     description: Issue access/refresh cookies
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: ok
 *       401:
 *         description: UNAUTHORIZED
 */
router.post(
  "/login",
  isTest
    ? (req, res, next) => next()
    : rateLimit({
        windowSec: 60,
        max: 5,
        keyGenerator: (req) => `rl:auth:login:${req.ip}`,
      }),
  async (req, res) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return sendError(res, "BAD_REQUEST", "email and password required");
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return sendError(res, "UNAUTHORIZED", "invalid credentials");
    }

    if (user.status !== "ACTIVE") {
      return sendError(res, "FORBIDDEN", "user not active");
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return sendError(res, "UNAUTHORIZED", "invalid credentials");
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role });

    // ✅ Redis session (skip in test)
    if (!isTest) {
      await redis.set(`session:${user.id}`, "1");
    }

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

/**
 * =========================
 * POST /api/auth/refresh
 * =========================
 */
/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     responses:
 *       200:
 *         description: refreshed
 *       401:
 *         description: UNAUTHORIZED
 */
router.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    return sendError(res, "UNAUTHORIZED", "missing refresh token");
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    return sendError(res, "UNAUTHORIZED", "invalid refresh token");
  }

  const hashed = hashToken(token);
  const record = await UserRefreshToken.findOne({
    where: { token_hash: hashed },
  });

  if (!record) {
    return sendError(res, "UNAUTHORIZED", "refresh token revoked");
  }

  await record.destroy();

  const user = await User.findByPk(payload.sub);
  if (!user || user.status !== "ACTIVE") {
    return sendError(res, "FORBIDDEN", "user not active");
  }

  const newAccess = signAccessToken({ sub: user.id, role: user.role });
  const newRefresh = signRefreshToken({ sub: user.id, role: user.role });

  await UserRefreshToken.create({
    user_id: user.id,
    token_hash: hashToken(newRefresh),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.cookie(ACCESS_COOKIE_NAME, newAccess, getAccessCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, newRefresh, getRefreshCookieOptions());

  return sendOk(res, {
    message: "refreshed",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
    },
  });
});

/**
 * =========================
 * POST /api/auth/logout
 * =========================
 */
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout
 */
router.post("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (token) {
    await UserRefreshToken.destroy({
      where: { token_hash: hashToken(token) },
    });
  }

  res.clearCookie(ACCESS_COOKIE_NAME);
  res.clearCookie(REFRESH_COOKIE_NAME);

  return sendOk(res, { message: "logout ok" });
});

export default router;
