// src/models/Project.js
import { DataTypes } from "sequelize";

export function defineProject(sequelize) {
  const Project = sequelize.define(
    "projects",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      workspace_id: { type: DataTypes.BIGINT, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.STRING(255), allowNull: true },
      status: { type: DataTypes.ENUM("ACTIVE", "ARCHIVED"), allowNull: false, defaultValue: "ACTIVE" },
      created_by: { type: DataTypes.BIGINT, allowNull: false },
    },
    {
      tableName: "projects",
      indexes: [{ fields: ["workspace_id"] }, { fields: ["status"] }],
    }
  );
  return Project;
}
