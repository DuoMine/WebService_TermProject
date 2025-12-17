// src/utils/jwt.js
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "../config/env.js";

function parseExpiresToSeconds(raw, fallbackSeconds) {
  const s = String(raw ?? "").trim();
  if (!s) return fallbackSeconds;
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(\d+)\s*([smhd])$/i);
  if (!m) return fallbackSeconds;
  const n = parseInt(m[1], 10);
  const u = m[2].toLowerCase();
  const mul = u === "s" ? 1 : u === "m" ? 60 : u === "h" ? 3600 : 86400;
  return n * mul;
}

export const ACCESS_COOKIE_NAME = "access_token";
export const REFRESH_COOKIE_NAME = "refresh_token";

export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function accessTtlSeconds() {
  return parseExpiresToSeconds(env.JWT_ACCESS_EXPIRES, 900);
}

export function refreshTtlSeconds() {
  return parseExpiresToSeconds(env.JWT_REFRESH_EXPIRES, 7 * 86400);
}

export function getAccessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: accessTtlSeconds() * 1000,
    path: "/",
  };
}

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: refreshTtlSeconds() * 1000,
    path: "/auth", // refresh/logout만 쓰게 범위 제한
  };
}
