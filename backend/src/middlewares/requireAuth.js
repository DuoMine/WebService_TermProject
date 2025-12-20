// src/middlewares/requireAuth.js
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "../utils/jwt.js";
import { sendError } from "../utils/http.js";

export function requireAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE_NAME];
  if (!token) return sendError(res, 401, "UNAUTHORIZED", "missing access token");

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: parseInt(payload.sub, 10),
      role: payload.role,
      tokenExp: payload.exp,
      payload,
    };
    return next();
  } catch (e) {
    const msg = e?.name === "TokenExpiredError" ? "access token expired" : "invalid access token";
    const code = e?.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "UNAUTHORIZED";
    return sendError(res, 401, code, msg);
  }
}

export function requireAdmin(req, res, next) {
  if (req.auth?.role !== "ADMIN") {
    return sendError(res, 403, "FORBIDDEN", "admin only");
  }
  next();
}
