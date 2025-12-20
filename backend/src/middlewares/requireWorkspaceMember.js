// src/middlewares/requireWorkspaceMember.js
import { models } from "../models/index.js";
import { sendError } from "../utils/http.js";

/**
 * 워크스페이스 멤버 여부만 체크
 * - ADMIN은 우회 가능
 * - 통과 시 req.workspace 세팅
 */
export function requireWorkspaceMember({ allowAdmin = true } = {}) {
  return async (req, res, next) => {
    const userId = req.auth?.userId;
    const role = req.auth?.role;
    const workspaceId = Number(req.params.workspaceId ?? req.params.id);

    if (!userId) return sendError(res, 401, "UNAUTHORIZED", "missing auth");
    if (!workspaceId) return sendError(res, 400, "BAD_REQUEST", "invalid workspaceId");

    // 전역 ADMIN 우회
    if (allowAdmin && role === "ADMIN") {
      const ws = await models.Workspace.findByPk(workspaceId);
      if (!ws) return sendError(res, 404, "NOT_FOUND", "workspace not found");
      req.workspace = ws;
      return next();
    }

    const ws = await models.Workspace.findByPk(workspaceId);
    if (!ws) return sendError(res, 404, "NOT_FOUND", "workspace not found");

    const member = await models.WorkspaceMember.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });

    if (!member) {
      return sendError(res, 403, "FORBIDDEN", "not a workspace member");
    }

    req.workspace = ws;
    return next();
  };
}

/**
 * 워크스페이스 OWNER 체크
 * - owner_id 단일 기준
 */
export function requireWorkspaceOwner({ allowAdmin = true } = {}) {
  return (req, res, next) => {
    const userId = req.auth?.userId;
    const role = req.auth?.role;

    if (allowAdmin && role === "ADMIN") return next();

    if (!req.workspace) {
      return sendError(res, 500, "INTERNAL_ERROR", "workspace not loaded");
    }

    if (req.workspace.owner_id !== userId) {
      return sendError(res, 403, "FORBIDDEN", "workspace owner only");
    }

    return next();
  };
}
