// src/config/env.js
import dotenv from "dotenv";
dotenv.config();

function must(name, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === null || String(v).trim() === "") {
    throw new Error(`Missing env: ${name}`);
  }
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: parseInt(process.env.PORT ?? "8080", 10),

  DB_HOST: must("DB_HOST"),
  DB_PORT: parseInt(process.env.DB_PORT ?? "3306", 10),
  DB_USER: must("DB_USER"),
  DB_PASSWORD: must("DB_PASSWORD"),
  DB_NAME: must("DB_NAME"),

  REDIS_URL: must("REDIS_URL"),

  JWT_ACCESS_SECRET: must("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: must("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES ?? "900s",
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES ?? "7d",

  VERSION: process.env.VERSION ?? "0.1.0",
  BUILD_TIME: process.env.BUILD_TIME ?? new Date().toISOString(),

  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};
