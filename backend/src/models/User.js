// src/models/User.js
import { DataTypes } from "sequelize";

export function defineUser(sequelize) {
  const User = sequelize.define(
    "users",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      email: { type: DataTypes.STRING(120), allowNull: true, unique: true },
      password_hash: { type: DataTypes.STRING(255), allowNull: true },
      name: { type: DataTypes.STRING(60), allowNull: false },
      role: { type: DataTypes.ENUM("USER", "ADMIN"), allowNull: false, defaultValue: "USER" },
      status: {
        type: DataTypes.ENUM("ACTIVE", "SUSPENDED", "DELETED"),
        allowNull: false,
        defaultValue: "ACTIVE",
      },
    },
    { tableName: "users" }
  );

  return User;
}
