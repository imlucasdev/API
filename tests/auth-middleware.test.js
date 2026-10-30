"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/test";
process.env.JWT_SECRET = "ci-auth-middleware-test-secret-material-32-bytes";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.CORS_ORIGINS = "http://localhost:5173";

const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const AdminRepository = require("../src/repositories/admin.repository");
const authMiddleware = require("../src/middleware/auth");
const { errorHandler } = require("../src/middleware/errorHandler");

async function createTestServer(t, app) {
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test("database failures during token identity lookup are reported as unavailable", async (t) => {
  const originalFindById = AdminRepository.findById;
  t.after(() => {
    AdminRepository.findById = originalFindById;
  });

  AdminRepository.findById = async () => {
    const error = new Error("simulated database connection reset");
    error.code = "ECONNRESET";
    throw error;
  };

  const app = express();
  app.get("/protected", authMiddleware, (_req, res) => res.json({ success: true }));
  const baseUrl = await createTestServer(t, app);
  const token = jwt.sign(
    { id: 1, role: "admin" },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "5m" },
  );

  const response = await fetch(`${baseUrl}/protected`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "SERVICE_UNAVAILABLE");
});

test("invalid admin token remains an authentication error rather than a database failure", async (t) => {
  const originalFindById = AdminRepository.findById;
  let lookupCount = 0;
  t.after(() => {
    AdminRepository.findById = originalFindById;
  });

  AdminRepository.findById = async () => {
    lookupCount += 1;
    return null;
  };

  const app = express();
  app.get("/protected", authMiddleware, (_req, res) => res.json({ success: true }));
  const baseUrl = await createTestServer(t, app);

  const response = await fetch(`${baseUrl}/protected`, {
    headers: { Authorization: "Bearer not-a-valid-token" },
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "INVALID_SESSION");
  assert.equal(lookupCount, 0);
});
