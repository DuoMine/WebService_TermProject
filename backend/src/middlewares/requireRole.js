// src/middlewares/requireRole.js
import { sendError } from "../utils/http.js";

export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.auth?.role;
    if (!role) return sendError(res, 401, "UNAUTHORIZED", "missing auth");
    if (!roles.includes(role)) return sendError(res, 403, "FORBIDDEN", "insufficient role");
    return next();
  };
}
