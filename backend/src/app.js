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
import workspacesRouter from "./routes/workspaces.js";
import projectsRouter from "./routes/projects.js";
import tasksRouter from "./routes/tasks.js";
import commentsRouter from "./routes/comments.js";
import tagsRouter from "./routes/tags.js";
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

/**
 * 🔐 workspace 스코프 전역 적용
 * - /api/workspaces/:workspaceId 로 시작하는 모든 요청은
 *   requireAuth + requireWorkspaceMember 통과해야 한다.
 * - /api/workspaces (목록/생성)은 workspaceId가 없으니 여기 적용 안 됨
 */
app.use("/api/workspaces/:workspaceId", requireAuth, requireWorkspaceMember());

/**
 * 라우터 마운트
 * - workspacesRouter: /api/workspaces + /api/workspaces/:workspaceId/... 둘 다 포함
 * - 그 외는 workspaceId 아래로만 노출
 */
app.use("/api/workspaces", workspacesRouter);
app.use("/api/workspaces/:workspaceId/projects", projectsRouter);
app.use("/api/workspaces/:workspaceId/projects/:projectId/tasks", tasksRouter);
app.use("/api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments", commentsRouter);
app.use("/api/workspaces/:workspaceId", tagsRouter);

app.use(errorHandler);

export default app;
