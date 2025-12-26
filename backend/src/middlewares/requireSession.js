import { redis } from "../config/redis.js";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "../utils/jwt.js";
import { sendError } from "../utils/http.js";

export async function requireSession(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE_NAME];
  if (!token) return sendError(res, "UNAUTHORIZED", "missing access token");

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (e) {
    return sendError(res, "UNAUTHORIZED", "invalid access token");
  }

  const userId = String(payload.sub);

  // Redis 세션 확인
  const sessionKey = `session:${userId}`;
  const session = await redis.get(sessionKey);
  if (!session) {
    return sendError(res, "UNAUTHORIZED", "session expired");
  }

  // 기존 requireAuth와 동일한 형태 유지
  req.auth = {
    userId: Number(userId),
    role: payload.role,
    tokenExp: payload.exp,
    payload,
  };

  next();
}
