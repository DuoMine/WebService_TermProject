import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redis } from "./config/redis.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { requireAuth } from "./middlewares/requireAuth.js";
import { requireWorkspaceMember } from "./middlewares/requireWorkspaceMember.js";
import { cache, clearCache } from "./middlewares/cache.js"; // 캐시 미들웨어 추가

// 라우터 import
import authRouter from "./routes/auth.js";
import healthRouter from "./routes/health.js";
import authSocialRouter from "./routes/authSocial.js";
import usersRouter from "./routes/users.js";
import workspacesRouter from "./routes/workspaces.js";
import projectsRouter from "./routes/projects.js";
import tasksRouter from "./routes/tasks.js";
import commentsRouter from "./routes/comments.js";
import tagsRouter from "./routes/tags.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger.js";

export const app = express();

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Redis 기반 전역 Rate Limit
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 1200,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
    }),
  })
);

app.get("/", (req, res) => res.json({ ok: true }));
app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter, authSocialRouter);

/**
 * 🔐 캐싱 전략 적용 (기존 라우터 파일 수정 없이 주입)
 */

// 1. 유저 관련 캐싱 (내 정보 등)
app.get(
  "/api/users/me",
  requireAuth,
  cache("users", 300),
  usersRouter
);

app.use("/api/users", usersRouter);

// 2. 워크스페이스 스코프 미들웨어
app.use("/api/workspaces/:workspaceId", requireAuth, requireWorkspaceMember());

// 3. 워크스페이스 자체 라우터
app.use("/api/workspaces", cache("workspaces", 60), clearCache("workspaces"), workspacesRouter);

// 4. 프로젝트 라우터
app.use(
  "/api/workspaces/:workspaceId/projects",
  cache("projects", 60),
  clearCache("projects"),
  projectsRouter
);

// 5. 태스크 라우터
app.use(
  "/api/workspaces/:workspaceId/projects/:projectId/tasks",
  cache("tasks", 30),
  clearCache("tasks"),
  tasksRouter
);

// 6. 댓글 라우터
app.use(
  "/api/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/comments",
  cache("comments", 10),
  clearCache("comments"),
  commentsRouter
);

// 7. 태그 라우터
app.use(
  "/api/workspaces/:workspaceId",
  cache("tags", 60),
  clearCache("tags"),
  tagsRouter
);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(errorHandler);

export default app;