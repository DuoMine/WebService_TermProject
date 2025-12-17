// src/middlewares/requireWorkspaceMember.js
import { models } from "../models/index.js";
import { sendError } from "../utils/http.js";

/**
 * 사용법:
 * router.get("/workspaces/:id", requireAuth, requireWorkspaceMember({ allowAdmin: true }), ...)
 * req.ws = { workspaceId, memberRole } 세팅
 */
export function requireWorkspaceMember({ allowAdmin = true } = {}) {
  return async (req, res, next) => {
    const userId = req.auth?.userId;
    const role = req.auth?.role;
    const workspaceId = parseInt(req.params.id ?? req.params.workspaceId, 10);

    if (!workspaceId) return sendError(res, 400, "BAD_REQUEST", "invalid workspaceId");
    if (!userId) return sendError(res, 401, "UNAUTHORIZED", "missing auth");

    if (allowAdmin && role === "ADMIN") {
      req.ws = { workspaceId, memberRole: "ADMIN" };
      return next();
    }

    const m = await models.WorkspaceMember.findOne({
      where: { workspace_id: workspaceId, user_id: userId },
    });

    if (!m) return sendError(res, 403, "FORBIDDEN", "not a workspace member");

    req.ws = { workspaceId, memberRole: m.member_role };
    return next();
  };
}

export function requireWorkspaceOwner({ allowAdmin = true } = {}) {
  return async (req, res, next) => {
    const role = req.auth?.role;
    if (allowAdmin && role === "ADMIN") return next();

    const memberRole = req.ws?.memberRole;
    if (memberRole !== "OWNER") return sendError(res, 403, "FORBIDDEN", "workspace owner only");
    return next();
  };
}
