// src/routes/api/auth.js
import { Router } from "express";
import bcrypt from "bcrypt";
import { models, sequelize } from "../models/index.js";
import { sendError, sendOk, sendCreated } from "../utils/http.js";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  getAccessCookieOptions,
  getRefreshCookieOptions,
  refreshTtlSeconds,
} from "../utils/jwt.js";

const router = Router();
const { User, UserRefreshToken } = models;

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
function isNonEmptyString(s, max) {
  return typeof s === "string" && s.trim().length > 0 && s.trim().length <= max;
}
function isStrongPassword(pw) {
  return typeof pw === "string" && pw.length >= 8 && pw.length <= 64;
}
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
 *   - name: Auth
 *     description: Authentication (cookie-based access/refresh)
 */
/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Sign up
 *     description: Create local account (email/password). Returns user info.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, example: "user1@test.com" }
 *               password: { type: string, example: "password1234" }
 *               name: { type: string, example: "user1" }
 *     responses:
 *       201:
 *         description: created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "signup ok" }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer, example: 1 }
 *                     email: { type: string, example: "user1@test.com" }
 *                     name: { type: string, example: "user1" }
 *                     role: { type: string, example: "USER" }
 *                     status: { type: string, example: "ACTIVE" }
 *                     createdAt: { type: string, example: "2025-12-22T10:00:00.000Z" }
 *               required: [message, user]
 *       400:
 *         description: VALIDATION_FAILED (details 포함)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       409:
 *         description: DUPLICATE_RESOURCE (email already exists)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR (failed to signup)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  const details = {};

  if (!isEmail(email)) details.email = "invalid email";
  if (!isStrongPassword(password)) details.password = "password length must be 8~64";
  if (!isNonEmptyString(name, 60)) details.name = "name must be 1~60 chars";

  if (Object.keys(details).length) {
    return sendError(res, "VALIDATION_FAILED", "validation failed", details);
  }

  try {
    const exists = await User.findOne({ where: { email } });
    if (exists) return sendError(res, "DUPLICATE_RESOURCE", "email already exists");

    const password_hash = await bcrypt.hash(password, 10);
    const u = await User.create({
      email,
      password_hash,
      name: name.trim(),
      role: "USER",
      status: "ACTIVE",
    });

    // ✅ 201은 sendCreated
    return sendCreated(res, { message: "signup ok", user: userPublic(u) });
  } catch (e) {
    console.error("POST /api/auth/signup error:", e);
    return sendError(res, "INTERNAL_SERVER_ERROR", "failed to signup");
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     description: Issue access/refresh cookies (refresh token stored hashed in DB).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "user1@test.com" }
 *               password: { type: string, example: "password1234" }
 *     responses:
 *       200:
 *         description: ok
 *         headers:
 *           Set-Cookie:
 *             description: access/refresh cookies
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "login ok" }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer, example: 1 }
 *                     email: { type: string, example: "user1@test.com" }
 *                     name: { type: string, example: "user1" }
 *                     role: { type: string, example: "USER" }
 *                     status: { type: string, example: "ACTIVE" }
 *                     createdAt: { type: string, example: "2025-12-22T10:00:00.000Z" }
 *               required: [message, user]
 *       400:
 *         description: VALIDATION_FAILED (details 포함)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED (invalid credentials / password login not available)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN (user not active)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR (failed to login)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const details = {};

  if (!isEmail(email)) details.email = "invalid email";
  if (typeof password !== "string") details.password = "password is required";

  if (Object.keys(details).length) {
    return sendError(res, "VALIDATION_FAILED", "validation failed", details);
  }

  try {
    const u = await User.findOne({ where: { email } });
    if (!u) return sendError(res, "UNAUTHORIZED", "invalid credentials");
    if (u.status !== "ACTIVE") return sendError(res, "FORBIDDEN", "user not active");
    if (!u.password_hash) return sendError(res, "UNAUTHORIZED", "password login not available");

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return sendError(res, "UNAUTHORIZED", "invalid credentials");

    const access = signAccessToken({ sub: String(u.id), role: u.role });
    const refresh = signRefreshToken({ sub: String(u.id), role: u.role });
    const expiresAt = new Date(Date.now() + refreshTtlSeconds() * 1000);

    await UserRefreshToken.create({
      user_id: u.id,
      token_hash: hashToken(refresh),
      expires_at: expiresAt,
      revoked_at: null,
    });

    res.cookie(ACCESS_COOKIE_NAME, access, getAccessCookieOptions());
    res.cookie(REFRESH_COOKIE_NAME, refresh, getRefreshCookieOptions());

    return sendOk(res, { message: "login ok", user: userPublic(u) });
  } catch (e) {
    console.error("POST /api/auth/login error:", e);
    return sendError(res, "INTERNAL_SERVER_ERROR", "failed to login");
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token (rotation)
 *     description: Rotate refresh token (revoke old, issue new). Requires refresh cookie.
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: ok
 *         headers:
 *           Set-Cookie:
 *             description: new access/refresh cookies
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "refreshed" }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: integer, example: 1 }
 *                     email: { type: string, example: "user1@test.com" }
 *                     name: { type: string, example: "user1" }
 *                     role: { type: string, example: "USER" }
 *                     status: { type: string, example: "ACTIVE" }
 *                     createdAt: { type: string, example: "2025-12-22T10:00:00.000Z" }
 *               required: [message, user]
 *       401:
 *         description: UNAUTHORIZED / TOKEN_EXPIRED (missing refresh token, invalid/expired refresh token)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       403:
 *         description: FORBIDDEN (user not active)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR (failed to refresh token)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) return sendError(res, "UNAUTHORIZED", "missing refresh token");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (e) {
    const code = e?.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "UNAUTHORIZED";
    const msg = e?.name === "TokenExpiredError" ? "refresh token expired" : "invalid refresh token";
    return sendError(res, code, msg);
  }

  const userId = parseInt(payload.sub, 10);
  if (!userId) return sendError(res, "UNAUTHORIZED", "invalid refresh token");

  const oldHash = hashToken(token);

  try {
    const result = await sequelize.transaction(async (t) => {
      const row = await UserRefreshToken.findOne({
        where: { token_hash: oldHash },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // 표준 코드만 사용
      if (!row) throw Object.assign(new Error("not found"), { _http: 401, _code: "UNAUTHORIZED" });
      if (row.revoked_at) throw Object.assign(new Error("revoked"), { _http: 401, _code: "UNAUTHORIZED" });
      if (new Date(row.expires_at).getTime() < Date.now()) {
        throw Object.assign(new Error("expired"), { _http: 401, _code: "TOKEN_EXPIRED" });
      }

      const u = await User.findOne({ where: { id: userId }, transaction: t, lock: t.LOCK.UPDATE });
      if (!u) throw Object.assign(new Error("user not found"), { _http: 401, _code: "UNAUTHORIZED" });
      if (u.status !== "ACTIVE") throw Object.assign(new Error("user not active"), { _http: 403, _code: "FORBIDDEN" });

      await row.update({ revoked_at: new Date() }, { transaction: t });

      const newAccess = signAccessToken({ sub: String(u.id), role: u.role });
      const newRefresh = signRefreshToken({ sub: String(u.id), role: u.role });
      const expiresAt = new Date(Date.now() + refreshTtlSeconds() * 1000);

      await UserRefreshToken.create(
        {
          user_id: u.id,
          token_hash: hashToken(newRefresh),
          expires_at: expiresAt,
          revoked_at: null,
        },
        { transaction: t }
      );

      return { u, newAccess, newRefresh };
    });

    res.cookie(ACCESS_COOKIE_NAME, result.newAccess, getAccessCookieOptions());
    res.cookie(REFRESH_COOKIE_NAME, result.newRefresh, getRefreshCookieOptions());
    return sendOk(res, { message: "refreshed", user: userPublic(result.u) });
  } catch (e) {
    const code = e?._code ?? "INTERNAL_SERVER_ERROR";

    const msgMap = {
      TOKEN_EXPIRED: "refresh token expired",
      UNAUTHORIZED: "invalid refresh token",
      INTERNAL_SERVER_ERROR: "failed to refresh token",
    };

    return sendError(res, code, msgMap[code] ?? "failed to refresh token");
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout
 *     description: Revoke current refresh token (if exists) and clear cookies.
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: ok
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "logout ok" }
 *               required: [message]
 *       500:
 *         description: INTERNAL_SERVER_ERROR (failed to logout)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router.post("/logout", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  try {
    if (token) {
      const h = hashToken(token);
      await UserRefreshToken.update(
        { revoked_at: new Date() },
        { where: { token_hash: h, revoked_at: null } }
      );
    }

    // ✅ path 통일(대부분 "/"가 안전)
    res.clearCookie(ACCESS_COOKIE_NAME, { path: "/" });
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });

    return sendOk(res, { message: "logout ok" });
  } catch (e) {
    console.error("POST /api/auth/logout error:", e);
    return sendError(res, "INTERNAL_SERVER_ERROR", "failed to logout");
  }
});

export default router;