import request from "supertest";
import { app } from "../src/app.js";
import { resetDb, closeDb } from "./helpers/db.js";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe("Auth API", () => {
  test("signup success", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      email: "a@test.com",
      password: "Test1234!",
      name: "a",
    });
    expect([200, 201]).toContain(res.status);
  });

  test("signup fail - missing email", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      password: "Test1234!",
      name: "a",
    });
    expect(res.status).toBe(400);
  });

  test("login success sets cookie", async () => {
    await request(app).post("/api/auth/signup").send({
      email: "b@test.com",
      password: "Test1234!",
      name: "b",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "b@test.com",
      password: "Test1234!",
    });

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeTruthy();
  });

  test("login fail - wrong password", async () => {
    await request(app).post("/api/auth/signup").send({
      email: "c@test.com",
      password: "Test1234!",
      name: "c",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "c@test.com",
      password: "wrong",
    });

    expect(res.status).toBe(401);
  });
});
