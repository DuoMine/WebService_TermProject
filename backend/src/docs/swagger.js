// src/docs/swagger.js
import swaggerJSDoc from "swagger-jsdoc";

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "WebService TermProject API",
      version: "1.0.0",
      description:
        "JWT 인증 기반 협업 관리 API (workspaces/projects/tasks/comments/tags) + 소셜 로그인(Firebase, Kakao)",
    },
    servers: [{ url: "/api", description: "API base" }],
    tags: [
      { name: "Health" },
      { name: "Auth" },
      { name: "Users" },
      { name: "Workspaces" },
      { name: "Projects" },
      { name: "Tasks" },
      { name: "Comments" },
      { name: "Tags" },
    ],
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "access_token" },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "UNAUTHORIZED" },
                message: { type: "string", example: "missing auth" },
              },
              required: ["code", "message"],
            },
          },
          required: ["ok", "error"],
        },
        OkResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            data: { type: "object" },
          },
          required: ["ok", "data"],
        },

        User: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            email: { type: "string", example: "user@test.com" },
            name: { type: "string", example: "user1" },
            role: { type: "string", example: "USER" },
            status: { type: "string", example: "ACTIVE" },
            created_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
            updated_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
          },
          required: ["id", "email", "name", "role", "status"],
        },

        Workspace: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1 },
            name: { type: "string", example: "team-a" },
            owner_id: { type: "integer", example: 1 },
            description: { type: "string", nullable: true, example: null },
            deleted_at: { type: "string", nullable: true, example: null },
            created_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
            updated_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
          },
          required: ["id", "name", "owner_id"],
        },

        Project: {
          type: "object",
          properties: {
            id: { type: "integer", example: 10 },
            workspace_id: { type: "integer", example: 1 },
            name: { type: "string", example: "backend" },
            description: { type: "string", nullable: true, example: "api server" },
            status: { type: "string", example: "ACTIVE" },
            created_by: { type: "integer", example: 1 },
            deleted_at: { type: "string", nullable: true, example: null },
            created_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
            updated_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
          },
          required: ["id", "workspace_id", "name", "status", "created_by"],
        },

        Task: {
          type: "object",
          properties: {
            id: { type: "integer", example: 100 },
            project_id: { type: "integer", example: 10 },
            title: { type: "string", example: "implement refresh rotation" },
            description: { type: "string", nullable: true, example: null },
            status: { type: "string", enum: ["TODO", "DOING", "DONE"], example: "TODO" },
            priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"], example: "MEDIUM" },
            due_at: { type: "string", nullable: true, example: null },
            created_by: { type: "integer", example: 1 },
            assignee_id: { type: "integer", nullable: true, example: null },
            deleted_at: { type: "string", nullable: true, example: null },
            created_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
            updated_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
          },
          required: ["id", "project_id", "title", "status", "priority", "created_by"],
        },

        Comment: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1000 },
            task_id: { type: "integer", example: 100 },
            user_id: { type: "integer", example: 1 },
            content: { type: "string", example: "looks good" },
            deleted_at: { type: "string", nullable: true, example: null },
            created_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
            updated_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
          },
          required: ["id", "task_id", "user_id", "content"],
        },

        Tag: {
          type: "object",
          properties: {
            id: { type: "integer", example: 7 },
            workspace_id: { type: "integer", example: 1 },
            name: { type: "string", example: "urgent" },
            created_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
          },
          required: ["id", "workspace_id", "name"],
        },

        TaskTag: {
          type: "object",
          properties: {
            task_id: { type: "integer", example: 100 },
            tag_id: { type: "integer", example: 7 },
            created_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
          },
          required: ["task_id", "tag_id"],
        },
      },
    },
  },

  apis: ["./src/routes/*.js", "./src/app.js"],
});
console.log(
  "[swaggerSpec]",
  Object.keys(swaggerSpec.paths || {}),
  "count:",
  Object.keys(swaggerSpec.paths || {}).length
);