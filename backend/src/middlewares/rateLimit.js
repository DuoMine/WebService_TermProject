// src/middlewares/rateLimit.js
import { redis } from "../config/redis.js";
import { sendError } from "../utils/http.js";

export function rateLimit({
  windowSec,
  max,
  keyGenerator,
}) {
  return async function rateLimitMiddleware(req, res, next) {
    try {
      const key = keyGenerator(req);

      // 🔹 Redis 카운트 증가
      const current = await redis.incr(key);

      // 🔹 첫 요청이면 TTL 설정
      if (current === 1) {
        await redis.expire(key, windowSec);
      }

      // 🔍 디버깅 로그 (중요)
      console.log("[RateLimit]", {
        key,
        current,
        ip: req.ip,
        path: req.originalUrl,
      });

      // 🔹 응답 헤더
      res.setHeader("RateLimit-Limit", max);
      res.setHeader("RateLimit-Remaining", Math.max(0, max - current));
      res.setHeader("RateLimit-Policy", `${max};w=${windowSec}`);

      // 🔹 초과 시 차단
      if (current > max) {
        return sendError(res, "TOO_MANY_REQUESTS", "rate limit exceeded");
      }

      return next();
    } catch (err) {
      console.error("[RateLimit] redis error", err);
      return next(err);
    }
  };
}
