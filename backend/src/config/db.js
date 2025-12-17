// src/config/db.js
import { Sequelize } from "sequelize";
import { env } from "./env.js";

export const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: "mysql",
  logging: env.NODE_ENV === "development" ? console.log : false,
  define: {
    underscored: true,
    timestamps: true,
    paranoid: true,          // deleted_at 자동
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  },
});
