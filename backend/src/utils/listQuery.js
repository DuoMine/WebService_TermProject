// size 기본/최대: 네 과제 요구에 맞게 여기서 고정
export function parsePagination(q) {
  const page = Math.max(1, parseInt(q.page ?? "1", 10));
  const size = Math.min(50, Math.max(1, parseInt(q.size ?? "20", 10)));
  const offset = (page - 1) * size;
  return { page, size, offset, limit: size };
}

export function parseSort(q, allowedFields, fallback = "createdAt,DESC") {
  const raw = String(q.sort ?? fallback);
  const [fieldRaw, dirRaw] = raw.split(",");
  const field = fieldRaw?.trim();
  const dir = (dirRaw ?? "DESC").trim().toUpperCase();

  const safeField = allowedFields.includes(field) ? field : fallback.split(",")[0];
  const safeDir = dir === "ASC" ? "ASC" : "DESC";

  return {
    sort: `${safeField},${safeDir}`,
    order: [[safeField, safeDir]],
  };
}

// "받을 수 있는 거 다"를 위해 일단 싹 파싱해두는 용도(=type/trim만 정리)
// 실제 where 반영은 라우트별로 필요한 것만 pick해서 쓰면 됨.
export function parseFilters(q) {
  const pick = (k) => {
    const v = q[k];
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s.length ? s : undefined;
  };

  return {
    keyword: pick("keyword"),
    status: pick("status"),
    role: pick("role"),

    // 날짜
    dateFrom: pick("dateFrom"),
    dateTo: pick("dateTo"),

    // 범용 FK/옵션 (리소스마다 유효한 것만 쓰기)
    ownerId: pick("ownerId"),
    authorId: pick("authorId"),
    assigneeId: pick("assigneeId"),
    projectId: pick("projectId"),
    taskId: pick("taskId"),
    tagId: pick("tagId"),

    // 태스크쪽에 있으면 유용
    priority: pick("priority"),
    dueFrom: pick("dueFrom"),
    dueTo: pick("dueTo"),
  };
}

export function toPageResult({ rows, count }, page, size, sort) {
  return {
    content: rows,
    page,                 // 1-base 유지
    size,
    totalElements: count,
    totalPages: Math.ceil(count / size),
    ...(sort ? { sort } : {}),
  };
}
