"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/test";
process.env.JWT_SECRET = "ci-blog-service-test-secret-material-32-bytes";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.CORS_ORIGINS = "http://localhost:5173";

const test = require("node:test");
const assert = require("node:assert/strict");
const BlogRepository = require("../src/repositories/blog.repository");
const BlogService = require("../src/services/blog.service");
const { pool } = require("../src/config/database");

test("public post reads sanitize legacy HTML returned from the database", async (t) => {
  const originalFindBySlug = BlogRepository.findBySlug;
  const originalIncrementViews = BlogRepository.incrementViews;
  const unsafePost = {
    id: 7,
    slug: "legacy-post",
    title: "Legacy post",
    published: true,
    content: '<p>Safe text</p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(2)">unsafe</a><a href="https://example.com" target="_blank">external</a>',
  };

  t.after(() => {
    BlogRepository.findBySlug = originalFindBySlug;
    BlogRepository.incrementViews = originalIncrementViews;
  });

  BlogRepository.findBySlug = async () => unsafePost;
  BlogRepository.incrementViews = async () => {};

  const result = await BlogService.getPublishedPost("legacy-post");
  assert.match(result.content, /<p>Safe text<\/p>/);
  assert.doesNotMatch(result.content, /<script|<img|onerror=|javascript:/i);
  assert.match(result.content, /href="https:\/\/example\.com"/);
  assert.match(result.content, /rel="noopener noreferrer"/);
});

test("admin post reads sanitize legacy draft HTML before returning it", async (t) => {
  const originalFindById = BlogRepository.findById;
  t.after(() => {
    BlogRepository.findById = originalFindById;
  });

  BlogRepository.findById = async () => ({
    id: 8,
    slug: "draft-post",
    title: "Draft post",
    published: false,
    content: '<h2>Draft</h2><svg onload="alert(1)"><script>alert(2)</script></svg><iframe src="https://attacker.example"></iframe>',
  });

  const result = await BlogService.getPostForAdmin(8);
  assert.match(result.content, /<h2>Draft<\/h2>/);
  assert.doesNotMatch(result.content, /<svg|<script|<iframe|onload=/i);
});

test("missing or unpublished posts remain hidden from public reads", async (t) => {
  const originalFindBySlug = BlogRepository.findBySlug;
  t.after(() => {
    BlogRepository.findBySlug = originalFindBySlug;
  });

  BlogRepository.findBySlug = async () => ({ id: 3, slug: "draft", published: false, content: "<p>secret</p>" });
  await assert.rejects(
    BlogService.getPublishedPost("draft"),
    (error) => error.code === "POST_NOT_FOUND" && error.status === 404,
  );

  BlogRepository.findBySlug = async () => null;
  await assert.rejects(
    BlogService.getPublishedPost("missing"),
    (error) => error.code === "POST_NOT_FOUND" && error.status === 404,
  );
});
