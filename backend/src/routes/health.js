// src/routes/health.js
import { Router } from "express";
import { env } from "../config/env.js";
import { sequelize } from "../models/index.js";
import { redis } from "../config/redis.js";
import { sendError } from "../utils/http.js";

const router = Router();
/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check (db/redis 포함)
 *     responses:
 *       200:
 *         description: ok + dependency status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: "ok" }
 *                 version: { type: string, example: "1.0.0" }
 *                 buildTime: { type: string, example: "2025-12-22T00:00:00Z" }
 *                 db: { type: string, example: "ok" }
 *                 redis: { type: string, example: "ok" }
 */
router.get("/", async (req, res) => {
  const out = {
    status: "ok",
    version: env.VERSION,
    buildTime: env.BUILD_TIME,
    db: "unknown",
    redis: "unknown",
  };

  let healthy = true;

  try {
    await sequelize.authenticate();
    out.db = "ok";
  } catch {
    out.db = "fail";
    healthy = false;
  }

  try {
    await redis.ping();
    out.redis = "ok";
  } catch {
    out.redis = "fail";
    healthy = false;
  }

  if (!healthy) {
    return sendError(
      res,
      503,
      "SERVICE_UNAVAILABLE",
      "service temporarily unavailable",
      out
    );
  }

  return res.status(200).json(out);
});

export default router;
