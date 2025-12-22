// src/utils/errorCodes.js
export const ERROR = Object.freeze({
  // 400
  BAD_REQUEST: { status: 400 },
  VALIDATION_FAILED: { status: 400 },
  INVALID_QUERY_PARAM: { status: 400 },

  // 401
  UNAUTHORIZED: { status: 401 },
  TOKEN_EXPIRED: { status: 401 },

  // 403
  FORBIDDEN: { status: 403 },

  // 404
  RESOURCE_NOT_FOUND: { status: 404 },
  USER_NOT_FOUND: { status: 404 },

  // 409
  DUPLICATE_RESOURCE: { status: 409 },
  STATE_CONFLICT: { status: 409 },

  // 422
  UNPROCESSABLE_ENTITY: { status: 422 },

  // 429
  TOO_MANY_REQUESTS: { status: 429 },

  // 500
  INTERNAL_SERVER_ERROR: { status: 500 },
  DATABASE_ERROR: { status: 500 },
  UNKNOWN_ERROR: { status: 500 },
});

export function assertKnownErrorCode(code) {
  if (!ERROR[code]) throw new Error(`Unknown error code: ${code}`);
}
