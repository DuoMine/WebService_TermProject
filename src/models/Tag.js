// src/models/Tag.js
import { DataTypes } from "sequelize";

export function defineTag(sequelize) {
  const Tag = sequelize.define(
    "tags",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      workspace_id: { type: DataTypes.BIGINT, allowNull: false },
      name: { type: DataTypes.STRING(40), allowNull: false },
    },
    {
      tableName: "tags",
      indexes: [{ unique: true, fields: ["workspace_id", "name"] }, { fields: ["workspace_id"] }],
    }
  );
  return Tag;
}
