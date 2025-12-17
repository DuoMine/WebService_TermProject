// src/models/UserProvider.js
import { DataTypes } from "sequelize";

export function defineUserProvider(sequelize) {
  const UserProvider = sequelize.define(
    "user_providers",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      provider: { type: DataTypes.ENUM("GOOGLE", "FIREBASE"), allowNull: false },
      provider_uid: { type: DataTypes.STRING(191), allowNull: false },
    },
    {
      tableName: "user_providers",
      indexes: [
        { unique: true, fields: ["provider", "provider_uid"] },
        { unique: true, fields: ["user_id", "provider"] },
      ],
    }
  );
  return UserProvider;
}
