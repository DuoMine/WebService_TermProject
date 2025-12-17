// src/models/UserRefreshToken.js
import { DataTypes } from "sequelize";

export function defineUserRefreshToken(sequelize) {
  const UserRefreshToken = sequelize.define(
    "user_refresh_tokens",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      token_hash: { type: DataTypes.CHAR(64), allowNull: false, unique: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      revoked_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "user_refresh_tokens",
      indexes: [{ fields: ["user_id"] }, { fields: ["expires_at"] }],
      paranoid: false,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );
  return UserRefreshToken;
}
