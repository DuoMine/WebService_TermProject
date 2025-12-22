// backend/scripts/seed.js
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import "dotenv/config";
import { runSqlFile } from "./db-runner.js";

const SALT_ROUNDS = 10;

async function main() {
  // 1) 기본 데이터 삽입
  await runSqlFile("seed/seed.sql");

  // 2) DB 연결
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // 3) 비밀번호 해시 생성
  const userHash = await bcrypt.hash(
    process.env.SEED_USER_PASSWORD,
    SALT_ROUNDS
  );
  const adminHash = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD,
    SALT_ROUNDS
  );

  // 4) 비밀번호 업데이트
  await conn.execute(
    "UPDATE users SET password_hash=? WHERE email='user1@example.com'",
    [userHash]
  );
  await conn.execute(
    "UPDATE users SET password_hash=? WHERE email='admin@example.com'",
    [adminHash]
  );

  // 5) 레코드 수 확인
  const [counts] = await conn.query(`
    SELECT
      (SELECT COUNT(*) FROM users)              AS users,
      (SELECT COUNT(*) FROM workspaces)         AS workspaces,
      (SELECT COUNT(*) FROM workspace_members)  AS workspace_members,
      (SELECT COUNT(*) FROM projects)           AS projects,
      (SELECT COUNT(*) FROM tasks)              AS tasks,
      (SELECT COUNT(*) FROM comments)           AS comments,
      (SELECT COUNT(*) FROM tags)               AS tags,
      (SELECT COUNT(*) FROM task_tags)          AS task_tags
  `);

  // 6) NOT NULL 핵심 컬럼 검증
  const [[projectNull]] = await conn.query(
    "SELECT COUNT(*) AS cnt FROM projects WHERE created_by IS NULL"
  );
  const [[taskNull]] = await conn.query(
    "SELECT COUNT(*) AS cnt FROM tasks WHERE created_by IS NULL"
  );

  await conn.end();

  // 7) 출력
  console.log("\n[seed] record counts");
  console.table(counts);

  console.log("[seed] integrity check");
  console.log("projects.created_by NULL =", projectNull.cnt);
  console.log("tasks.created_by NULL    =", taskNull.cnt);

  if (projectNull.cnt !== 0 || taskNull.cnt !== 0) {
    throw new Error("seed integrity check failed (created_by NULL)");
  }

  console.log("[seed] completed successfully");
}

main().catch((e) => {
  console.error("[seed] failed:", e);
  process.exit(1);
});
