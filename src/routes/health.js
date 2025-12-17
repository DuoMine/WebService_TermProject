// src/routes/health.js
import { Router } from "express";
import { env } from "../config/env.js";
import { sequelize } from "../models/index.js";
import { redis } from "../config/redis.js";

const router = Router();

router.get("/", async (req, res) => {
  const out = {
    status: "ok",
    version: env.VERSION,
    buildTime: env.BUILD_TIME,
  };

  try {
    await sequelize.authenticate();
    out.db = "ok";
  } catch {
    out.db = "fail";
  }

  try {
    await redis.ping();
    out.redis = "ok";
  } catch {
    out.redis = "fail";
  }

  return res.status(200).json(out);
});

export default router;
