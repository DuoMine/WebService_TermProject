import { describe, test, before } from "node:test";
import assert from "node:assert";
import request from "supertest";
import app from "../src/app.js";

const NOT_EXIST_ID = 999999999;

describe("API 자동화 테스트 (Supertest)", () => {
  let accessToken;
  let refreshToken;
  let workspaceId;
  let projectId;
  let taskId;

  const user = {
    email:"user1@example.com",
    password:"P@ssw0rd!"
  };

  /* =========================
     Auth
  ========================= */

  describe("Auth", () => {
    before(async () => {
      const res = await request(app).post("/api/auth/login").send(user);
      assert.strictEqual(res.status, 200);

      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    test("로그인 실패 - 비밀번호 오류", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ ...user, password: "wrong" });

      assert.strictEqual(res.status, 401);
    });

    test("토큰 없이 보호 API 접근 → 401", async () => {
      const res = await request(app).get("/api/workspaces");
      assert.strictEqual(res.status, 401);
    });

    test("Refresh token 재발급 성공", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken });

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.accessToken);
    });

    test("Refresh token 누락 → 400", async () => {
      const res = await request(app).post("/api/auth/refresh").send({});
      assert.strictEqual(res.status, 400);
    });

    test("잘못된 Authorization 토큰 → 401", async () => {
      const res = await request(app)
        .get("/api/workspaces")
        .set("Authorization", "Bearer garbage-token");

      assert.strictEqual(res.status, 401);
    });
  });

  /* =========================
     Workspace
  ========================= */

  describe("Workspace", () => {
    test("워크스페이스 생성 성공", async () => {
      const res = await request(app)
        .post("/api/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ name: "Test Workspace" });

      assert.strictEqual(res.status, 201);
      workspaceId = res.body.data.id;
    });

    test("워크스페이스 생성 실패 - name 누락", async () => {
      const res = await request(app)
        .post("/api/workspaces")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      assert.strictEqual(res.status, 400);
    });

    test("워크스페이스 목록 조회 성공", async () => {
      const res = await request(app)
        .get("/api/workspaces")
        .set("Authorization", `Bearer ${accessToken}`);

      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
    });

    test("존재하지 않는 워크스페이스 조회 → 404", async () => {
      const res = await request(app)
        .get(`/api/workspaces/${NOT_EXIST_ID}`)
        .set("Authorization", `Bearer ${accessToken}`);

      assert.strictEqual(res.status, 404);
    });

    test("잘못된 토큰으로 워크스페이스 접근 → 401", async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}`)
        .set("Authorization", "Bearer invalid.token.here");

      assert.strictEqual(res.status, 401);
    });
  });

  /* =========================
     Project
  ========================= */

  describe("Project", () => {
    test("프로젝트 생성 성공", async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Project 1" });

      assert.strictEqual(res.status, 201);
      projectId = res.body.data.id;
    });

    test("프로젝트 생성 실패 - title 누락", async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      assert.strictEqual(res.status, 400);
    });

    test("프로젝트 목록 조회 성공", async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${accessToken}`);

      assert.strictEqual(res.status, 200);
    });

    test("잘못된 프로젝트 ID → 404", async () => {
      const res = await request(app)
        .get(`/api/projects/${NOT_EXIST_ID}`)
        .set("Authorization", `Bearer ${accessToken}`);

      assert.strictEqual(res.status, 404);
    });
  });

  /* =========================
     Task
  ========================= */

  describe("Task", () => {
    test("Task 생성 성공", async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ title: "Task 1" });

      assert.strictEqual(res.status, 201);
      taskId = res.body.data.id;
    });

    test("Task 생성 실패 - title 누락", async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({});

      assert.strictEqual(res.status, 400);
    });

    test("Task 목록 조회 성공", async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/tasks`)
        .set("Authorization", `Bearer ${accessToken}`);

      assert.strictEqual(res.status, 200);
    });

    test("Task 삭제 성공", async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      assert.strictEqual(res.status, 200);
    });

    test("이미 삭제된 Task 삭제 → 404", async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      assert.strictEqual(res.status, 404);
    });
  });

  /* =========================
     Logout
  ========================= */

  describe("Logout", () => {
    test("로그아웃 성공", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .send({ refreshToken });

      assert.strictEqual(res.status, 200);
    });
  });
});
