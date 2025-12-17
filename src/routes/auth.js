// src/routes/auth.js
import { Router } from "express";
import bcrypt from "bcrypt";
import { models, sequelize } from "../models/index.js";
import { sendError, sendOk } from "../utils/http.js";
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
  // 최소 8~64
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
 * POST /auth/signup
 * body: { email, password, name }
 */
router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body ?? {};
  const details = {};

  if (!isEmail(email)) details.email = "invalid email";
  if (!isStrongPassword(password)) details.password = "password length must be 8~64";
  if (!isNonEmptyString(name, 60)) details.name = "name must be 1~60 chars";

  if (Object.keys(details).length) {
    return sendError(res, 422, "VALIDATION_FAILED", "validation failed", details);
  }

  try {
    const exists = await User.findOne({ where: { email } });
    if (exists) return sendError(res, 409, "DUPLICATE_RESOURCE", "email already exists");

    const password_hash = await bcrypt.hash(password, 10);
    const u = await User.create({
      email,
      password_hash,
      name: name.trim(),
      role: "USER",
      status: "ACTIVE",
    });

    return sendOk(res, { message: "signup ok", user: userPublic(u) }, 201);
  } catch (e) {
    console.error("POST /auth/signup error:", e);
    return sendError(res, 500, "INTERNAL_SERVER_ERROR", "failed to signup");
  }
});

/**
 * POST /auth/login
 * body: { email, password }
 * - access/refresh 쿠키 세팅
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const details = {};
  if (!isEmail(email)) details.email = "invalid email";
  if (typeof password !== "string") details.password = "password is required";
  if (Object.keys(details).length) {
    return sendError(res, 422, "VALIDATION_FAILED", "validation failed", details);
  }

  try {
    const u = await User.findOne({ where: { email } });
    if (!u) return sendError(res, 401, "UNAUTHORIZED", "invalid credentials");
    if (u.status !== "ACTIVE") return sendError(res, 403, "FORBIDDEN", "user not active");
    if (!u.password_hash) return sendError(res, 401, "UNAUTHORIZED", "password login not available");

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return sendError(res, 401, "UNAUTHORIZED", "invalid credentials");

    const access = signAccessToken({ sub: String(u.id), role: u.role });
    const refresh = signRefreshToken({ sub: String(u.id), role: u.role });

    const now = Date.now();
    const expiresAt = new Date(now + refreshTtlSeconds() * 1000);

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
    console.error("POST /auth/login error:", e);
    return sendError(res, 500, "INTERNAL_SERVER_ERROR", "failed to login");
  }
});

/**
 * POST /auth/refresh
 * - refresh 쿠키 검증 + DB 토큰 해시 확인
 * - refresh token rotation: 기존 토큰 revoked 후 새 refresh 발급/저장
 */
router.post("/refresh", async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) return sendError(res, 401, "UNAUTHORIZED", "missing refresh token");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (e) {
    const code = e?.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "UNAUTHORIZED";
    const msg = e?.name === "TokenExpiredError" ? "refresh token expired" : "invalid refresh token";
    return sendError(res, 401, code, msg);
  }

  const userId = parseInt(payload.sub, 10);
  if (!userId) return sendError(res, 401, "UNAUTHORIZED", "invalid refresh token");

  const oldHash = hashToken(token);

  try {
    const result = await sequelize.transaction(async (t) => {
      const row = await UserRefreshToken.findOne({
        where: { token_hash: oldHash },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!row) throw Object.assign(new Error("not found"), { _http: 401, _code: "UNAUTHORIZED" });
      if (row.revoked_at) throw Object.assign(new Error("revoked"), { _http: 401, _code: "UNAUTHORIZED" });
      if (new Date(row.expires_at).getTime() < Date.now())
        throw Object.assign(new Error("expired"), { _http: 401, _code: "TOKEN_EXPIRED" });

      // 유저 상태 확인
      const u = await User.findOne({ where: { id: userId }, transaction: t });
      if (!u) throw Object.assign(new Error("user not found"), { _http: 401, _code: "UNAUTHORIZED" });
      if (u.status !== "ACTIVE") throw Object.assign(new Error("user not active"), { _http: 403, _code: "FORBIDDEN" });

      // revoke old
      await row.update({ revoked_at: new Date() }, { transaction: t });

      // issue new
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
    console.error("REFRESH ERROR:", e?.name, e?.message);
    console.error("sqlMessage:", e?.parent?.sqlMessage);
    console.error("code:", e?.parent?.code, "errno:", e?.parent?.errno);
    const http = e?._http ?? 500;
    const code = e?._code ?? "INTERNAL_SERVER_ERROR";
    const msg =
      http === 500 ? "failed to refresh token" : "invalid refresh token";
    return sendError(res, http, code, msg);
  }
});

/**
 * POST /auth/logout
 * - refresh token revoke + 쿠키 제거
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

    res.clearCookie(ACCESS_COOKIE_NAME, { path: "/" });
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/auth" });

    return sendOk(res, { message: "logout ok" });
  } catch (e) {
    console.error("POST /auth/logout error:", e);
    return sendError(res, 500, "INTERNAL_SERVER_ERROR", "failed to logout");
  }
});

/**
 * GET /auth/me
 * - access token 필요 (requireAuth에서 req.auth 세팅됨)
 */
router.get("/me", async (req, res) => {
  // 여기서는 requireAuth 미들웨어를 라우터 연결 시 걸어줄 거라 req.auth 사용 가능
  const userId = req.auth?.userId;
  if (!userId) return sendError(res, 401, "UNAUTHORIZED", "missing auth");

  const u = await User.findOne({ where: { id: userId } });
  if (!u) return sendError(res, 404, "USER_NOT_FOUND", "user not found");
  return sendOk(res, { user: userPublic(u) });
});

/**
 * (다음 단계) 소셜 로그인 endpoints - 일단 501로 막아둠
 */
router.get("/google", (req, res) => {
  return sendError(res, 501, "NOT_IMPLEMENTED", "google oauth not implemented yet");
});
router.post("/firebase", (req, res) => {
  return sendError(res, 501, "NOT_IMPLEMENTED", "firebase auth not implemented yet");
});

export default router;
