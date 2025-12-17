// src/utils/sort.js
const ALLOWED_DIR = new Set(["ASC", "DESC"]);

export function parseSort(raw, allowedFields, fallback = ["created_at", "DESC"]) {
  // raw: "created_at,DESC"
  if (!raw) return fallback;

  const [field, dirRaw] = String(raw).split(",").map((s) => s.trim());
  const dir = (dirRaw ?? "").toUpperCase();

  if (!allowedFields.includes(field)) return fallback;
  if (!ALLOWED_DIR.has(dir)) return fallback;

  return [field, dir];
}
