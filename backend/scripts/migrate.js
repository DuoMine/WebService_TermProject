// backend/scripts/migrate.js
import { runSqlFile } from "./db-runner.js";

async function main() {
  // backend 기준 경로
  await runSqlFile("migrations/001_init.sql");
}

main().catch((e) => {
  console.error("[migrate] failed:", e);
  process.exit(1);
});
