// src/models/Comment.js
import { DataTypes } from "sequelize";

export function defineComment(sequelize) {
  const Comment = sequelize.define(
    "comments",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      task_id: { type: DataTypes.BIGINT, allowNull: false },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      content: { type: DataTypes.STRING(500), allowNull: false },
    },
    {
      tableName: "comments",
      indexes: [{ fields: ["task_id"] }],
    }
  );
  return Comment;
}
