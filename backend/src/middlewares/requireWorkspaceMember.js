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
    try {
      const userId = req.auth?.userId;
      const role = req.auth?.role;

      const raw = req.params.workspaceId ?? req.params.id;
      const workspaceId = Number.parseInt(raw, 10);

      if (!userId) {
        return sendError(res, "UNAUTHORIZED", "missing auth");
      }

      if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
        return sendError(res, "BAD_REQUEST", "invalid workspaceId");
      }

      const ws = await models.Workspace.findByPk(workspaceId);
      if (!ws) {
        return sendError(res, "RESOURCE_NOT_FOUND", "workspace not found");
      }

      // ADMIN 우회
      if (allowAdmin && role === "ADMIN") {
        req.workspace = ws;
        return next();
      }

      const member = await models.WorkspaceMember.findOne({
        where: { workspace_id: workspaceId, user_id: userId },
      });

      if (!member) {
        return sendError(res, "FORBIDDEN", "not a workspace member");
      }

      req.workspace = ws;
      return next();
    } catch (err) {
      return next(err);
    }
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
      return sendError(res, "INTERNAL_SERVER_ERROR", "workspace not loaded");
    }

    if (req.workspace.owner_id !== userId) {
      return sendError(res, "FORBIDDEN", "workspace owner only");
    }

    return next();
  };
}
