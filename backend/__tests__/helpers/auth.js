import request from "supertest";
import { app } from "../../src/app.js";

export async function signupAndLogin() {
  const email = `test_${Date.now()}@test.com`;
  const password = "Test1234!";

  // signup
  await request(app)
    .post("/api/auth/signup")
    .send({ email, password, name: "tester" });

  // login
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  if (!res.headers["set-cookie"]) {
    throw new Error("Login did not return cookies");
  }

  return {
    email,
    password,
    cookies: res.headers["set-cookie"],
  };
}
