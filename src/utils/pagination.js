// src/utils/pagination.js
export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page ?? "1", 10));
  const size = Math.min(50, Math.max(1, parseInt(query.size ?? "10", 10)));
  const offset = (page - 1) * size;
  return { page, size, offset, limit: size };
}

export function toPageResult({ rows, count }, page, size, sort) {
  return {
    content: rows,
    page,
    size,
    totalElements: count,
    totalPages: Math.ceil(count / size),
    ...(sort ? { sort } : {}),
  };
}
