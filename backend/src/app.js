// src/app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redis } from "./config/redis.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { requireAuth } from "./middlewares/requireAuth.js";
import authRouter from "./routes/auth.js";
import healthRouter from "./routes/health.js";
import authSocialRouter from "./routes/authSocial.js";
import usersRouter from "./routes/users.js";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ✅ Redis 기반 전역 rate limit (필수요건 증빙용)
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
    }),
    handler: (req, res) =>
      res.status(429).json({
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        status: 429,
        code: "TOO_MANY_REQUESTS",
        message: "too many requests",
      }),
  })
);

app.get("/", (req, res) => res.json({ ok: true }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter, authSocialRouter);
app.use("/api/users", usersRouter);
// TODO: auth/users/workspaces/projects/tasks/comments/tags/stats 라우터 연결

app.use(errorHandler);

export default app;
