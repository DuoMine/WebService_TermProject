// src/models/Workspace.js
import { DataTypes } from "sequelize";

export function defineWorkspace(sequelize) {
  const Workspace = sequelize.define(
    "workspaces",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING(80), allowNull: false },
      description: { type: DataTypes.STRING(255), allowNull: true },
      owner_id: { type: DataTypes.BIGINT, allowNull: false },
    },
    { tableName: "workspaces" }
  );
  return Workspace;
}
