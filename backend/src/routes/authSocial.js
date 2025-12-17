import { Router } from "express";
import crypto from "crypto";
import { models } from "../models/index.js";
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
import jwt from "jsonwebtoken"; // 이미 쓰고 있으면 생략


const router = Router();
const { User, UserRefreshToken } = models;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function getExpDateFromJwt(token) {
  const decoded = jwt.decode(token); // 검증 말고 decode만
  const expSec = decoded?.exp;
  if (!expSec) return null;
  return new Date(expSec * 1000);
}

// POST /api/v1/auth/social/firebase
router.post("/social/firebase", async (req, res) => {
  const { idToken } = req.body ?? {};
  if (!idToken) return sendError(res, 400, "BAD_REQUEST", "idToken required");

  let decoded;
  try {
    decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
  } catch {
    return sendError(res, 401, "UNAUTHORIZED", "invalid firebase token");
  }

  const email = decoded.email ?? null;
  const name = decoded.name ?? (email ? email.split("@")[0] : "user");

  if (!email) return sendError(res, 400, "BAD_REQUEST", "email not provided");

  // ✅ 스키마가 password NOT NULL이면 여기서 막힘
  // -> password nullable로 바꾸거나, 랜덤 비밀번호 해시를 defaults에 넣어야 함
  const [user] = await User.findOrCreate({
    where: { email },
    defaults: {
      email,
      name,
      role: "USER",
      status: "ACTIVE",
    },
  });

  const accessToken = signAccessToken({ sub: String(user.id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user.id), role: user.role });

  const now = Date.now();
  const expiresAt = new Date(now + refreshTtlSeconds() * 1000);

  await UserRefreshToken.upsert({
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: expiresAt,
    revoked_at: null,
  });

  res.cookie(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  return sendOk(res, { message: "social login success", user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

export default router;
