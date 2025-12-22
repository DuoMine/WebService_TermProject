// backend/scripts/db-runner.js
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import "dotenv/config";

function must(name, v) {
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function runSqlFile(relativePathFromBackend) {
  const sqlPath = path.resolve(process.cwd(), relativePathFromBackend);
  const sql = fs.readFileSync(sqlPath, "utf8");

  const host = must("DB_HOST", process.env.DB_HOST);
  const port = Number(process.env.DB_PORT ?? "3306");
  const user = must("DB_USER", process.env.DB_USER);
  const password = must("DB_PASSWORD", process.env.DB_PASSWORD);
  const database = must("DB_NAME", process.env.DB_NAME);

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    // SQL 파일에 여러 statement가 있으므로 필수
    multipleStatements: true,
  });

  try {
    console.log(`[db] running: ${relativePathFromBackend}`);
    await conn.query(sql);
    console.log("[db] done");
  } finally {
    await conn.end();
  }
}
