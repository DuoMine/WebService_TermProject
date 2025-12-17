// src/utils/http.js
export function sendOk(res, payload, status = 200) {
  return res.status(status).json(payload);
}

export function sendError(res, status, code, message, details) {
  return res.status(status).json({
    timestamp: new Date().toISOString(),
    path: res.req.originalUrl,
    status,
    code,
    message,
    ...(details ? { details } : {}),
  });
}
