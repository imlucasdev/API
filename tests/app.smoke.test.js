"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/test";
process.env.JWT_SECRET = "ci-smoke-test-secret-material-more-than-32-bytes";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.CORS_ORIGINS = "http://localhost:5173";

const test = require("node:test");
const assert = require("node:assert/strict");
const exportedExpressApp = require("../src/app");
const { createApp } = exportedExpressApp;
const { pool } = require("../src/config/database");

test("Vercel-recognized Express entry exports an application instance", () => {
  assert.equal(typeof exportedExpressApp, "function");
  assert.equal(typeof exportedExpressApp.createApp, "function");
  assert.equal(typeof exportedExpressApp.listen, "function");
});

test("API app boots and serves the expected public surfaces securely", async (t) => {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  t.after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await pool.end();
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const root = await fetch(baseUrl);
  assert.equal(root.status, 200);
  assert.match(root.headers.get("content-security-policy") || "", /script-src 'self'/);
  assert.equal(root.headers.get("x-powered-by"), null);
  assert.match(await root.text(), /LUXJSON API/);

  const specResponse = await fetch(`${baseUrl}/swagger.json`);
  assert.equal(specResponse.status, 200);
  assert.equal(specResponse.headers.get("cache-control"), "no-store");
  const spec = await specResponse.json();
  assert.equal(spec.openapi, "3.0.3");
  assert.equal(spec.servers[0].url, "https://api.luxjson.is-a.dev");
  assert.ok(spec.paths && Object.keys(spec.paths).length >= 15, "OpenAPI spec must document the API routes");
  assert.ok(spec.paths["/api/blog/posts"], "Blog list/create contract must be documented");
  assert.ok(spec.paths["/api/blog/posts/{identifier}"], "Blog read/update/delete contract must be documented");
  assert.ok(spec.paths["/api/community/posts/{id}/like"], "Community like contract must be documented");
  assert.ok(spec.paths["/api/community/admin/posts/{id}/moderate"], "Moderation contract must be documented");
  assert.ok(spec.components?.schemas?.ErrorResponse, "Common error response schema must be documented");

  const docs = await fetch(`${baseUrl}/docs`);
  assert.equal(docs.status, 200);
  const docsCsp = docs.headers.get("content-security-policy") || "";
  assert.match(docsCsp, /frame-ancestors 'none'/);
  const docsNonce = docsCsp.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(docsNonce, "Scalar docs must receive a fresh CSP nonce.");
  assert.doesNotMatch(docsCsp, /'unsafe-eval'/);
  assert.match(docsCsp, /font-src[^;]*https:\/\/fonts\.scalar\.com/);
  assert.equal(docs.headers.get("cache-control"), "private, no-store");

  const docsHtml = await docs.text();
  const zodConfigIndex = docsHtml.indexOf("globalThis.__zod_globalConfig");
  const scalarBundleIndex = docsHtml.indexOf("cdn.jsdelivr.net/npm/@scalar/api-reference");
  assert.ok(zodConfigIndex >= 0, "Zod JIT must be disabled before Scalar loads.");
  assert.ok(scalarBundleIndex > zodConfigIndex, "Zod configuration must execute before the Scalar bundle.");
  assert.ok(docsHtml.includes(`nonce="${docsNonce}"`), "Scalar scripts and the Zod bootstrap must use the response nonce.");

  const secondDocs = await fetch(`${baseUrl}/docs`);
  const secondDocsCsp = secondDocs.headers.get("content-security-policy") || "";
  const secondDocsNonce = secondDocsCsp.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(secondDocsNonce);
  assert.notEqual(secondDocsNonce, docsNonce, "Every documentation response must use a new nonce.");

  const anonymousAdmin = await fetch(`${baseUrl}/api/blog/stats`);
  assert.equal(anonymousAdmin.status, 401);

  const deniedOrigin = await fetch(`${baseUrl}/swagger.json`, {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(deniedOrigin.status, 403);
  assert.equal((await deniedOrigin.json()).code, "CORS_ORIGIN_DENIED");

  const missing = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).code, "NOT_FOUND");
});
