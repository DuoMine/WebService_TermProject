import { Router } from "express";
import crypto from "crypto";
import qs from "qs";
import { sequelize, models } from "../models/index.js";
import { firebaseAdmin } from "../config/firebaseAdmin.js";
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  getAccessCookieOptions,
  getRefreshCookieOptions,
  refreshTtlSeconds,
} from "../utils/jwt.js";
import { sendError, sendOk } from "../utils/http.js";

const router = Router();
const { User, UserRefreshToken, UserProvider } = models;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function issueCookiesAndPersistRefresh(res, user) {
  const accessToken = signAccessToken({ sub: String(user.id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user.id), role: user.role });

  const expiresAt = new Date(Date.now() + refreshTtlSeconds() * 1000);

  await UserRefreshToken.upsert({
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: expiresAt,
    revoked_at: null,
  });

  res.cookie(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  return { accessToken, refreshToken };
}

function pickName({ nickname, email, fallback }) {
  if (nickname) return nickname;
  if (email) return email.split("@")[0];
  return fallback ?? "user";
}

/**
 * (공통) provider 기반 로그인/가입
 * - provider+uid로 먼저 찾고
 * - 없으면 (email 있으면) 기존 유저에 연결(계정 합치기)
 * - 없으면 새 유저 생성 후 연결
 */
async function loginOrSignupWithProvider({ provider, providerUid, email, nickname }) {
  const t = await sequelize.transaction();
  try {
    // 1) provider link로 먼저 찾기
    const link = await UserProvider.findOne({
      where: { provider, provider_uid: providerUid },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    let user;

    if (link) {
      user = await User.findByPk(link.user_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (!user) throw new Error("linked user not found");
    } else {
      // 2) 링크 없으면: email이 있으면 기존 user와 연결 시도
      if (email) {
        user = await User.findOne({ where: { email }, transaction: t, lock: t.LOCK.UPDATE });
      }

      if (!user) {
        user = await User.create(
          {
            email: email ?? null,
            name: pickName({ nickname, email, fallback: `${provider.toLowerCase()}_${providerUid}` }),
            role: "USER",
            status: "ACTIVE",
          },
          { transaction: t }
        );
      } else {
        // 기존 유저 보강
        let changed = false;
        if (!user.email && email) {
          user.email = email;
          changed = true;
        }
        // name은 allowNull:false라 보통 이미 있음. 그래도 빈값 같은 케이스 대비.
        if ((!user.name || user.name.trim() === "") && (nickname || email)) {
          user.name = pickName({ nickname, email, fallback: user.name });
          changed = true;
        }
        if (changed) await user.save({ transaction: t });
      }

      // 3) provider link 생성
      await UserProvider.create(
        { user_id: user.id, provider, provider_uid: providerUid },
        { transaction: t }
      );
    }

    await t.commit();
    return user;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

/**
 * ✅ POST /api/v1/auth/social/firebase
 * body: { idToken }
 */
/**
 * @swagger
 * /auth/social/firebase:
 *   post:
 *     tags: [Auth]
 *     summary: Firebase(Google) social login
 *     description: Verify Firebase ID token, login/signup user, set access/refresh cookies.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *                 example: "eyJhbGciOi..."
 *     responses:
 *       200:
 *         description: Social login success (cookies set)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message, user]
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "social login success"
 *                 user:
 *                   type: object
 *                   required: [id, email, name, role]
 *                   properties:
 *                     id: { type: integer, example: 1 }
 *                     email: { type: string, nullable: true, example: "user@test.com" }
 *                     name: { type: string, example: "user" }
 *                     role: { type: string, example: "USER" }
 *       400:
 *         description: BAD_REQUEST (e.g., idToken required). VALIDATION_FAILED may include details.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED (invalid firebase token / firebase uid missing)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR (firebase social login error)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router.post("/social/firebase", async (req, res) => {
  const { idToken } = req.body ?? {};
  if (!idToken) return sendError(res, "BAD_REQUEST", "idToken required");

  let decoded;
  try {
    decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
  } catch {
    return sendError(res, "UNAUTHORIZED", "invalid firebase token");
  }

  // Firebase의 고유 식별자
  const providerUid = decoded.uid ? String(decoded.uid) : null;
  if (!providerUid) return sendError(res, "UNAUTHORIZED", "firebase uid missing");

  const email = decoded.email ?? null;
  const nickname = decoded.name ?? null;

  let user;
  try {
    user = await loginOrSignupWithProvider({
      provider: "FIREBASE",
      providerUid,
      email,
      nickname,
    });
  } catch (e) {
    return sendError(
      res,
      "INTERNAL_SERVER_ERROR",
      `firebase social login error: ${String(e?.message ?? e)}`
    );
  }

  await issueCookiesAndPersistRefresh(res, user);

  return sendOk(res, {
    message: "social login success",
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

/**
 * ✅ GET /api/auth/social/kakao/start
 */
/**
 * @swagger
 * /auth/social/kakao/start:
 *   get:
 *     tags: [Auth]
 *     summary: Start Kakao OAuth (redirect)
 *     description: Set oauth state cookie and redirect to Kakao authorize URL.
 *     responses:
 *       302:
 *         description: Redirect to Kakao authorize URL
 *       500:
 *         description: INTERNAL_SERVER_ERROR (kakao env missing)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router.get("/social/kakao/start", (req, res) => {
  const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;
  const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;

  if (!KAKAO_REST_KEY || !KAKAO_REDIRECT_URI) {
    return sendError(res, "INTERNAL_SERVER_ERROR", "kakao env missing");
  }

  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("kakao_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 5 * 60 * 1000,
  });

  const url =
    "https://kauth.kakao.com/oauth/authorize" +
    `?client_id=${encodeURIComponent(KAKAO_REST_KEY)}` +
    `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  return res.redirect(url);
});

/**
 * ✅ GET /api/v1/auth/social/kakao/callback (provider 버전)
 */
/**
 * @swagger
 * /auth/social/kakao/callback:
 *   get:
 *     tags: [Auth]
 *     summary: Kakao OAuth callback (code 처리 후 redirect)
 *     description: Exchange code for Kakao access token, fetch user info, login/signup, set cookies, then redirect to frontend.
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Redirect to frontend after login (cookies set)
 *       400:
 *         description: BAD_REQUEST (invalid oauth state). VALIDATION_FAILED may include details.
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       401:
 *         description: UNAUTHORIZED (kakao auth failed / missing kakao id/access token)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 *       500:
 *         description: INTERNAL_SERVER_ERROR / UNKNOWN_ERROR (env missing or external fetch error or server error)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorResponse" }
 */
router.get("/social/kakao/callback", async (req, res) => {
  const { code, state } = req.query ?? {};
  const savedState = req.cookies?.kakao_oauth_state;

  if (!code || !state || !savedState || state !== savedState) {
    return sendError(res, "BAD_REQUEST", "invalid oauth state");
  }
  res.clearCookie("kakao_oauth_state");

  const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;
  const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;
  const FRONTEND_URL = process.env.FRONTEND_URL;

  if (!KAKAO_REST_KEY || !KAKAO_REDIRECT_URI || !FRONTEND_URL) {
    return sendError(res, "INTERNAL_SERVER_ERROR", "kakao env missing");
  }

  // 1) code -> token
  let tokenJson;
  try {
    const tokenResp = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: qs.stringify({
        grant_type: "authorization_code",
        client_id: KAKAO_REST_KEY,
        redirect_uri: KAKAO_REDIRECT_URI,
        code: String(code),
      }),
    });

    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return sendError(res, "UNAUTHORIZED", `kakao token failed: ${t}`);
    }
    tokenJson = await tokenResp.json();
  } catch (e) {
    return sendError(res, "UNKNOWN_ERROR", `kakao token fetch error: ${String(e?.message ?? e)}`);
  }

  const kakaoAccessToken = tokenJson?.access_token;
  if (!kakaoAccessToken) return sendError(res, "UNAUTHORIZED", "kakao access_token missing");

  // 2) user/me
  let me;
  try {
    const meResp = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });

    if (!meResp.ok) {
      const t = await meResp.text();
      return sendError(res, "UNAUTHORIZED", `kakao me failed: ${t}`);
    }
    me = await meResp.json();
  } catch (e) {
    return sendError(res, "UNKNOWN_ERROR", `kakao me fetch error: ${String(e?.message ?? e)}`);
  }

  const providerUid = me?.id ? String(me.id) : null;
  if (!providerUid) return sendError(res, "UNAUTHORIZED", "kakao id missing");

  const nickname = me?.kakao_account?.profile?.nickname ?? null;

  let user;
  try {
    user = await loginOrSignupWithProvider({
      provider: "KAKAO",
      providerUid,
      email: null,
      nickname,
    });
  } catch (e) {
    return sendError(
      res,
      "INTERNAL_SERVER_ERROR",
      `kakao social login error: ${String(e?.message ?? e)}`
    );
  }

  await issueCookiesAndPersistRefresh(res, user);

  // 프론트에서 /api/v1/auth/me로 상태 갱신
  return res.redirect(`${FRONTEND_URL}/auth/success`);
});

export default router;
