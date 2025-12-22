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
        // 네 프로젝트가 쿠키 기반 access/refresh 라면 이게 제일 덜 거슬림
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
            owner_user_id: { type: "integer", example: 1 },
            created_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
            updated_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
          },
          required: ["id", "name", "owner_user_id"],
        },

        Project: {
          type: "object",
          properties: {
            id: { type: "integer", example: 10 },
            workspace_id: { type: "integer", example: 1 },
            name: { type: "string", example: "backend" },
            description: { type: "string", example: "api server" },
            created_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
            updated_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
          },
          required: ["id", "workspace_id", "name"],
        },

        Task: {
          type: "object",
          properties: {
            id: { type: "integer", example: 100 },
            project_id: { type: "integer", example: 10 },
            title: { type: "string", example: "implement refresh rotation" },
            description: { type: "string", example: "..." },
            status: { type: "string", example: "TODO" },
            due_date: { type: "string", nullable: true, example: null },
            created_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
            updated_at: { type: "string", example: "2025-12-22T10:00:00.000Z" },
          },
          required: ["id", "project_id", "title", "status"],
        },

        Comment: {
          type: "object",
          properties: {
            id: { type: "integer", example: 1000 },
            task_id: { type: "integer", example: 100 },
            user_id: { type: "integer", example: 1 },
            content: { type: "string", example: "looks good" },
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
      },
    },
  },

  // ✅ 네 프로젝트 구조에서 routes 주석을 긁어오는 경로들
  apis: ["./src/routes/**/*.js", "./src/app.js", "./src/routes/*.js"],
});
