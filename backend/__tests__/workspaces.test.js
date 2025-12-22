import request from "supertest";
import { app } from "../src/app.js";
import { resetDb, closeDb } from "./helpers/db.js";
import { signupAndLogin } from "./helpers/auth.js";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe("Workspaces API", () => {
  test("create workspace success", async () => {
    const { cookies } = await signupAndLogin();

    const res = await request(app)
      .post("/api/workspaces")
      .set("Cookie", cookies)
      .send({ name: "ws1" });

    expect([200, 201]).toContain(res.status);
  });

  test("create workspace fail - missing name", async () => {
    const { cookies } = await signupAndLogin();

    const res = await request(app)
      .post("/api/workspaces")
      .set("Cookie", cookies)
      .send({});

    expect(res.status).toBe(400);
  });

  test("get workspaces list success", async () => {
    const { cookies } = await signupAndLogin();

    await request(app)
      .post("/api/workspaces")
      .set("Cookie", cookies)
      .send({ name: "ws1" });

    const res = await request(app)
      .get("/api/workspaces")
      .set("Cookie", cookies);

    expect(res.status).toBe(200);
  });

  test("get workspace fail - not found", async () => {
    const { cookies } = await signupAndLogin();

    const res = await request(app)
      .get("/api/workspaces/999999")
      .set("Cookie", cookies);

    expect(res.status).toBe(404);
  });

  test("get members fail - not a member (403)", async () => {
    const u1 = await signupAndLogin();
    const ws = await request(app)
      .post("/api/workspaces")
      .set("Cookie", u1.cookies)
      .send({ name: "ws1" });

    const workspaceId = ws.body.data.id;

    const u2 = await signupAndLogin();
    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/members`)
      .set("Cookie", u2.cookies);

    expect(res.status).toBe(403);
  });
});
