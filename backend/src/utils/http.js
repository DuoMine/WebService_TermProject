// src/utils/http.js
export function sendOk(res, payload, status = 200) {
  return res.status(status).json(payload);
}

export function sendError(res, status, code, message, details) {
  const path = res?.req?.originalUrl ?? "";
  return res.status(status).json({
    timestamp: new Date().toISOString(),
    path,
    status,
    code,
    message,
    ...(details ? { details } : {}),
  });
}
