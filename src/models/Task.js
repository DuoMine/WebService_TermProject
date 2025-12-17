// src/models/Task.js
import { DataTypes } from "sequelize";

export function defineTask(sequelize) {
  const Task = sequelize.define(
    "tasks",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      project_id: { type: DataTypes.BIGINT, allowNull: false },
      title: { type: DataTypes.STRING(120), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.ENUM("TODO", "DOING", "DONE"), allowNull: false, defaultValue: "TODO" },
      priority: { type: DataTypes.ENUM("LOW", "MEDIUM", "HIGH"), allowNull: false, defaultValue: "MEDIUM" },
      due_at: { type: DataTypes.DATE, allowNull: true },
      created_by: { type: DataTypes.BIGINT, allowNull: false },
      assignee_id: { type: DataTypes.BIGINT, allowNull: true },
    },
    {
      tableName: "tasks",
      indexes: [
        { fields: ["project_id"] },
        { fields: ["status"] },
        { fields: ["assignee_id"] },
        { fields: ["due_at"] },
      ],
    }
  );
  return Task;
}
