// src/middlewares/errorHandler.js
import { sendError } from "../utils/http.js";

export function errorHandler(err, req, res, next) {
  console.error("Unhandled error:", err);

  // Sequelize validation
  if (err?.name === "SequelizeValidationError") {
    const details = {};
    for (const e of err.errors ?? []) details[e.path] = e.message;
    return sendError(res, 422, "VALIDATION_FAILED", "validation failed", details);
  }

  // Sequelize FK / unique
  if (err?.name === "SequelizeUniqueConstraintError") {
    return sendError(res, 409, "DUPLICATE_RESOURCE", "duplicate resource");
  }
  if (err?.name === "SequelizeForeignKeyConstraintError") {
    return sendError(res, 409, "STATE_CONFLICT", "foreign key constraint");
  }

  return sendError(res, 500, "INTERNAL_SERVER_ERROR", "internal server error");
}
