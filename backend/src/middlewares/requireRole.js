// src/middlewares/requireRole.js
import { sendError } from "../utils/http.js";

export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.auth?.role;
    if (!role) return sendError(res, "UNAUTHORIZED", "missing auth");
    if (!roles.includes(role)) return sendError(res, "FORBIDDEN", "insufficient role");
    return next();
  };
}
