"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { slugify } = require("../src/utils/helpers");
const { sanitizePostHtml } = require("../src/utils/sanitizePostHtml");
const {
  blogListQuery,
  createBlogPost,
  updateBlogPost,
  idParams,
} = require("../src/validators/blog.validators");
const communitySchemas = require("../src/validators/community.validators");
const authSchemas = require("../src/validators/community-auth.validators");

test("slug generation normalizes accents and spaces", () => {
  assert.equal(slugify("Olá Mundo"), "ola-mundo");
  assert.equal(slugify("Coração Código"), "coracao-codigo");
});

test("post sanitization strips scripts, inline handlers and unsafe URLs", () => {
  const unsafe = '<p onclick="alert(1)">hello<img src=x onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">unsafe</a><a href="https://example.com" target="_blank">safe</a></p>';
  const clean = sanitizePostHtml(unsafe);
  assert.doesNotMatch(clean, /<script|onclick=|onerror=|javascript:/i);
  assert.match(clean, /href="https:\/\/example\.com"/);
  assert.match(clean, /rel="noopener noreferrer"/);
});

test("blog list validates bounded pagination and visibility flags", () => {
  assert.deepEqual(
    blogListQuery.parse({ limit: "50", offset: "2", publishedOnly: "false" }),
    { limit: 50, offset: 2, publishedOnly: false },
  );
  assert.deepEqual(
    blogListQuery.parse({ limit: "10", offset: "0" }),
    { limit: 10, offset: 0, publishedOnly: true },
  );
  assert.equal(blogListQuery.safeParse({ limit: "1000000", offset: "0" }).success, false);
  assert.equal(blogListQuery.safeParse({ limit: "-1", offset: "0" }).success, false);
  assert.equal(blogListQuery.safeParse({ limit: "10", offset: "0", publishedOnly: "yes" }).success, false);
});

test("blog writes reject empty input and unsafe remote image URLs", () => {
  assert.equal(createBlogPost.safeParse({ title: "Title", content: "<p>text</p>", cover_image: "javascript:alert(1)" }).success, false);
  assert.equal(createBlogPost.safeParse({ title: " ", content: "x" }).success, false);
  assert.equal(updateBlogPost.safeParse({}).success, false);
  assert.equal(updateBlogPost.safeParse({ published: false }).success, true);
  assert.equal(createBlogPost.safeParse({ title: "Title", content: "<p>text</p>", published: false }).success, true);
});

test("route IDs must be positive integers", () => {
  assert.equal(idParams.safeParse({ id: "3" }).success, true);
  assert.equal(idParams.safeParse({ id: "0" }).success, false);
  assert.equal(idParams.safeParse({ id: "1 OR 1=1" }).success, false);
});

test("community input validates content, pagination and moderation actions", () => {
  assert.equal(communitySchemas.createPost.safeParse({ content: "hello" }).success, true);
  assert.equal(communitySchemas.createPost.safeParse({ content: " " }).success, false);
  assert.equal(communitySchemas.listQuery.safeParse({ limit: "100", offset: "0" }).success, false);
  assert.equal(communitySchemas.moderatePost.safeParse({ action: "approve" }).success, true);
  assert.equal(communitySchemas.moderatePost.safeParse({ action: "DROP TABLE" }).success, false);
});

test("community registration sets a password byte ceiling and checks confirmation", () => {
  const valid = {
    name: "Lucas",
    username: "lucasdev",
    password: "long-enough-password",
    confirmPassword: "long-enough-password",
  };
  assert.equal(authSchemas.register.safeParse(valid).success, true);
  assert.equal(authSchemas.register.safeParse({ ...valid, confirmPassword: "not-the-same" }).success, false);
  assert.equal(authSchemas.register.safeParse({ ...valid, username: "x" }).success, false);
});
