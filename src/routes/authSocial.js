// src/routes/authSocial.js
import { Router } from "express";
import { models } from "../config/db.js";
import { firebaseAdmin } from "../config/firebaseAdmin.js";
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  getAccessCookieOptions,
  getRefreshCookieOptions,
} from "../utils/jwt.js";

const router = Router();
const { Users, UserRefreshTokens } = models;

router.post("/social/firebase", async (req, res) => {
  const { idToken } = req.body ?? {};
  if (!idToken) return res.status(400).json({ code: "BAD_REQUEST", message: "idToken required" });

  // 1) Firebase 토큰 검증
  let decoded;
  try {
    decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ code: "UNAUTHORIZED", message: "invalid firebase token" });
  }

  const uid = decoded.uid;
  const email = decoded.email ?? null;
  const name = decoded.name ?? decoded.email?.split("@")[0] ?? "user";

  if (!email) {
    // Google은 보통 email 줌. 다른 provider 대비 안전장치
    return res.status(400).json({ code: "BAD_REQUEST", message: "email not provided by provider" });
  }

  // 2) 유저 upsert (email 기준)
  const [user] = await Users.findOrCreate({
    where: { email },
    defaults: {
      email,
      name,
      role: "USER",
      status: "ACTIVE",
      // password는 null 허용되게 스키마/모델 조정 권장
    },
  });

  // (선택) 이미 있는데 name 비어있으면 업데이트
  if (!user.name && name) await user.update({ name });

  // 3) 너희 JWT 쿠키 발급
  const accessToken = signAccessToken({ sub: String(user.id), role: user.role });
  const refreshToken = signRefreshToken({ sub: String(user.id), role: user.role });

  // refreshToken 저장(이미 너가 409를 성공으로 처리하고 싶다 했던 그 구간일 확률 높음)
  // ✅ 권장: user_id에 대해 최신 1개만 유지하는 upsert로 깔끔하게
  const hash = (t) => require("crypto").createHash("sha256").update(t).digest("hex");

  await UserRefreshTokens.upsert({
    user_id: user.id,
    token_hash: hash(refreshToken),
    revoked_at: null,
  });

  res.cookie(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  return res.status(200).json({
    message: "social login success",
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

export default router;
