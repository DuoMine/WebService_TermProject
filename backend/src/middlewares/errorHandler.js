// src/middlewares/errorHandler.js
import { sendError } from "../utils/http.js";

export function errorHandler(err, req, res, next) {
  console.error("Unhandled error:", err);

  if (err?.name === "SequelizeValidationError") {
    const details = {};
    for (const e of err.errors ?? []) details[e.path] = e.message;
    return sendError(res, "VALIDATION_FAILED", "validation failed", details);
  }

  if (err?.name === "SequelizeUniqueConstraintError") {
    return sendError(res, "DUPLICATE_RESOURCE", "duplicate resource");
  }

  if (err?.name === "SequelizeForeignKeyConstraintError") {
    return sendError(res, "STATE_CONFLICT", "resource has dependent data");
  }

  return sendError(res, "UNKNOWN_ERROR", "unknown error");
}
