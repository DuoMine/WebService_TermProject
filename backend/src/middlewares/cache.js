import { redis } from "../config/redis.js";

/**
 * [조회용] cache 미들웨어
 * GET 요청의 결과를 Redis에 저장하고, 동일 요청 시 캐시된 데이터를 반환합니다.
 */
export function cache(prefix, ttl = 30) {
  return async (req, res, next) => {
    // GET 요청이 아니면 캐싱하지 않음
    if (req.method !== "GET") return next();

    const userId = req.auth?.userId ?? "guest";
    // 쿼리 파라미터까지 포함된 URL을 키로 사용 (페이징, 필터링 대응)
    const key = `${prefix}:${userId}:${req.originalUrl}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        console.log(`⚡ Redis cache HIT: ${key}`);
        return res.json(JSON.parse(cached));
      }

      console.log(`Redis cache MISS: ${key}`);

      // res.json을 가로채서 결과가 성공적일 때만 Redis에 저장
      const originalJson = res.json.bind(res);
      res.json = async (body) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await redis.set(key, JSON.stringify(body), "EX", ttl);
          console.log(`💾 Redis cache SET: ${key}`);
        }
        originalJson(body);
      };

      next();
    } catch (err) {
      console.error("Redis Cache Error:", err);
      next(); // 에러 시 원본 로직 진행
    }
  };
}

/**
 * [삭제용] clearCache 미들웨어
 * POST, PATCH, DELETE 요청이 성공하면 해당 도메인(prefix)의 캐시를 모두 삭제합니다.
 */
export function clearCache(prefix) {
  return async (req, res, next) => {
    // 변경 요청이 아니면 통과
    if (!["POST", "PATCH", "DELETE", "PUT"].includes(req.method)) return next();

    const originalJson = res.json.bind(res);

    res.json = async (body) => {
      const userId = req.auth?.userId ?? "guest";
      const pattern = `${prefix}:${userId}:*`;

      // 먼저 클라이언트에 응답을 보냄 (속도 향상)
      originalJson(body);

      try {
        // 해당 유저의 특정 도메인 캐시 키들을 찾아 일괄 삭제
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(keys);
          console.log(`Redis cache CLEARED: ${pattern} (${keys.length} keys)`);
        }
      } catch (err) {
        console.error("Redis Clear Error:", err);
      }
    };

    next();
  };
}