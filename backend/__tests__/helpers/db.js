import { sequelize } from "../../src/config/db.js";

export async function resetDb() {
  // 테스트는 빠르게 가야 한다 → force sync OK
  await sequelize.sync({ force: true });
}

export async function closeDb() {
  await sequelize.close();
}
