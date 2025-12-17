// src/models/WorkspaceMember.js
import { DataTypes } from "sequelize";

export function defineWorkspaceMember(sequelize) {
  const WorkspaceMember = sequelize.define(
    "workspace_members",
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      workspace_id: { type: DataTypes.BIGINT, allowNull: false },
      user_id: { type: DataTypes.BIGINT, allowNull: false },
      member_role: { type: DataTypes.ENUM("OWNER", "MEMBER"), allowNull: false, defaultValue: "MEMBER" },
    },
    {
      tableName: "workspace_members",
      indexes: [{ unique: true, fields: ["workspace_id", "user_id"] }, { fields: ["user_id"] }],
      paranoid: false, // 멤버십은 soft delete 굳이 필요 없음(원하면 켜도 됨)
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );
  return WorkspaceMember;
}
