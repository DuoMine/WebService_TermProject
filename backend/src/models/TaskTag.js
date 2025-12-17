// src/models/TaskTag.js
import { DataTypes } from "sequelize";

export function defineTaskTag(sequelize) {
  const TaskTag = sequelize.define(
    "task_tags",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      task_id: { type: DataTypes.BIGINT, allowNull: false },
      tag_id: { type: DataTypes.BIGINT, allowNull: false },
    },
    {
      tableName: "task_tags",
      indexes: [{ unique: true, fields: ["task_id", "tag_id"] }, { fields: ["tag_id"] }],
      paranoid: false,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );
  return TaskTag;
}
