// src/utils/errorCodes.js
export const ERROR = Object.freeze({
  BAD_REQUEST: { status: 400 },
  VALIDATION_FAILED: { status: 400 },
  INVALID_QUERY_PARAM: { status: 400 },

  UNAUTHORIZED: { status: 401 },
  TOKEN_EXPIRED: { status: 401 },

  FORBIDDEN: { status: 403 },

  RESOURCE_RESOURCE_NOT_FOUND: { status: 404 },
  USER_RESOURCE_NOT_FOUND: { status: 404 },

  DUPLICATE_RESOURCE: { status: 409 },
  STATE_CONFLICT: { status: 409 },

  UNPROCESSABLE_ENTITY: { status: 422 },

  TOO_MANY_REQUESTS: { status: 429 },

  INTERNAL_SERVER_ERROR: { status: 500 },
  DATABASE_ERROR: { status: 500 },

  SERVICE_UNAVAILABLE: { status: 503 },
});

export function assertKnownErrorCode(code) {
  if (!ERROR[code]) {
    throw new Error(`Unknown error code: ${code}`);
  }
}
