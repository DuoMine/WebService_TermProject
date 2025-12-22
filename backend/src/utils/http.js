// src/utils/http.js
import { ERROR, assertKnownErrorCode } from "./errorCodes.js";

export function sendOk(res, data = {}, meta) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(200).json(body);
}

export function sendCreated(res, data = {}) {
  return res.status(201).json({ success: true, data });
}

export function sendNoContent(res) {
  return res.status(204).send();
}

export function sendError(res, code, message, details) {
  assertKnownErrorCode(code);

  const httpStatus = ERROR[code].status;
  if (expected !== httpStatus) {
    throw new Error(`Status mismatch: ${code} expects ${expected}, got ${httpStatus}`);
  }
  
  const body = {
    success: false,
    timestamp: new Date().toISOString(),
    path: res.req?.originalUrl ?? res.req?.url ?? "",
    status: httpStatus,
    code,
    message,
  };
  if (details !== undefined) body.details = details;

  return res.status(httpStatus).json(body);
}
