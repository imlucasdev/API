"use strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:5432/test";
process.env.JWT_SECRET = "ci-api-flow-test-secret-material-32-bytes";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.CORS_ORIGINS = "http://localhost:5173";

const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const AdminRepository = require("../src/repositories/admin.repository");
const BlogRepository = require("../src/repositories/blog.repository");
const CommunityUsersRepository = require("../src/repositories/community-users.repository");
const CommunityRepository = require("../src/repositories/community.repository");
const { createApp } = require("../src/app");
const { pool } = require("../src/config/database");

test("website admin and community client flows match the API contracts", async (t) => {
  const now = new Date().toISOString();
  const admin = {
    id: 1,
    username: "admin",
    password_hash: await bcrypt.hash("strong-admin-password", 4),
    created_at: now,
  };
  const blogPosts = new Map([[1, {
    id: 1,
    title: "Public post",
    slug: "public-post",
    content: '<p>Public content</p><script>alert(1)</script>',
    excerpt: "Public excerpt",
    cover_image: null,
    author_id: 1,
    published: true,
    published_at: now,
    created_at: now,
    views: 0,
  }]]);
  let nextBlogId = 2;
  const communityUsers = new Map();
  let nextUserId = 1;
  const communityPosts = new Map();
  let nextCommunityPostId = 1;
  const likes = new Set();
  const reports = [];

  const original = {
    adminFindByUsername: AdminRepository.findByUsername,
    adminFindById: AdminRepository.findById,
    blogFindAll: BlogRepository.findAll,
    blogFindBySlug: BlogRepository.findBySlug,
    blogIncrementViews: BlogRepository.incrementViews,
    blogFindById: BlogRepository.findById,
    blogCreate: BlogRepository.create,
    blogUpdate: BlogRepository.update,
    blogDelete: BlogRepository.delete,
    blogGetStats: BlogRepository.getStats,
    userFindByUsername: CommunityUsersRepository.findByUsername,
    userFindById: CommunityUsersRepository.findById,
    userCreate: CommunityUsersRepository.create,
    userUpdate: CommunityUsersRepository.update,
    commIsUsernameTaken: CommunityRepository.isUsernameTaken,
    commGetPosts: CommunityRepository.getPosts,
    commCreatePost: CommunityRepository.createPost,
    commToggleLike: CommunityRepository.toggleLike,
    commReportPost: CommunityRepository.reportPost,
    commFindPostOwner: CommunityRepository.findPostOwner,
    commDeletePost: CommunityRepository.deletePost,
    commGetUserPosts: CommunityRepository.getUserPosts,
    commGetReportedPosts: CommunityRepository.getReportedPosts,
    commModeratePost: CommunityRepository.moderatePost,
  };

  const publicAdmin = () => ({
    id: admin.id,
    username: admin.username,
    created_at: admin.created_at,
  });
  const publicUser = (user) => ({
    id: user.id,
    registration_number: user.registration_number,
    name: user.name,
    username: user.username,
    avatar_url: user.avatar_url || null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  });
  const publicCommunityPost = (post, viewer) => {
    const user = post.author_user_id ? communityUsers.get(post.author_user_id) : null;
    const likePrefix = String(post.id) + ":";
    const keys = Array.from(likes);
    const liked = viewer && viewer.userId
      ? likes.has(likePrefix + "u" + viewer.userId)
      : viewer && viewer.adminId
        ? likes.has(likePrefix + "a" + viewer.adminId)
        : false;
    return {
      id: post.id,
      content: post.content,
      author_user_id: post.author_user_id,
      author_admin_id: post.author_admin_id,
      is_admin_post: post.is_admin_post,
      status: post.status,
      created_at: post.created_at,
      author_name: user ? user.name : admin.username,
      author_username: user ? user.username : admin.username,
      registration_number: user ? user.registration_number : null,
      avatar_url: user ? user.avatar_url : null,
      likes_count: keys.filter((key) => key.startsWith(likePrefix)).length,
      liked_by_me: liked,
    };
  };

  AdminRepository.findByUsername = async (username) =>
    username.toLowerCase() === admin.username.toLowerCase() ? admin : null;
  AdminRepository.findById = async (id) => Number(id) === admin.id ? publicAdmin() : null;

  BlogRepository.findAll = async ({ limit = 10, offset = 0, publishedOnly = true } = {}) =>
    Array.from(blogPosts.values())
      .filter((post) => publishedOnly ? post.published : true)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(offset, offset + limit)
      .map(({ content, ...post }) => ({ ...post }));
  BlogRepository.findBySlug = async (slug) => Array.from(blogPosts.values()).find((post) => post.slug === slug) || null;
  BlogRepository.incrementViews = async (slug) => {
    const post = Array.from(blogPosts.values()).find((item) => item.slug === slug);
    if (post && post.published) post.views += 1;
  };
  BlogRepository.findById = async (id) => blogPosts.get(Number(id)) || null;
  BlogRepository.create = async (data) => {
    const post = {
      id: nextBlogId++,
      ...data,
      created_at: new Date().toISOString(),
      published_at: data.published ? new Date().toISOString() : null,
      views: 0,
    };
    blogPosts.set(post.id, post);
    const { content, ...response } = post;
    return response;
  };
  BlogRepository.update = async (id, data) => {
    const post = blogPosts.get(Number(id));
    if (!post) return null;
    const wasPublished = post.published;
    Object.assign(post, data);
    if (!wasPublished && post.published) post.published_at = new Date().toISOString();
    const { content, ...response } = post;
    return response;
  };
  BlogRepository.delete = async (id) => blogPosts.delete(Number(id));
  BlogRepository.getStats = async () => ({
    posts: blogPosts.size,
    published: Array.from(blogPosts.values()).filter((post) => post.published).length,
    views: Array.from(blogPosts.values()).reduce((total, post) => total + post.views, 0),
  });

  CommunityUsersRepository.findByUsername = async (username) =>
    Array.from(communityUsers.values()).find((user) => user.username.toLowerCase() === username.toLowerCase()) || null;
  CommunityUsersRepository.findById = async (id) => {
    const user = communityUsers.get(Number(id));
    return user ? publicUser(user) : null;
  };
  CommunityUsersRepository.create = async ({ name, username, passwordHash }) => {
    const userId = nextUserId++;
    const user = {
      id: userId,
      registration_number: 7000 + userId,
      name,
      username,
      password_hash: passwordHash,
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    communityUsers.set(user.id, user);
    return publicUser(user);
  };
  CommunityUsersRepository.update = async (id, fields) => {
    const user = communityUsers.get(Number(id));
    if (!user) return null;
    Object.assign(user, fields, { updated_at: new Date().toISOString() });
    return publicUser(user);
  };

  CommunityRepository.isUsernameTaken = async (username, excludeId) =>
    username.toLowerCase() === admin.username.toLowerCase() ||
    Array.from(communityUsers.values()).some((user) =>
      user.id !== excludeId && user.username.toLowerCase() === username.toLowerCase());
  CommunityRepository.getPosts = async ({ limit, offset, userId, adminId }) => {
    const all = Array.from(communityPosts.values())
      .filter((post) => ["active", "approved"].includes(post.status))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return {
      posts: all.slice(offset, offset + limit).map((post) => publicCommunityPost(post, { userId, adminId })),
      total: all.length,
    };
  };
  CommunityRepository.createPost = async ({ content, userId, adminId, isAdminPost }) => {
    const post = {
      id: nextCommunityPostId++,
      content,
      author_user_id: userId,
      author_admin_id: adminId,
      is_admin_post: isAdminPost,
      status: "active",
      created_at: new Date().toISOString(),
    };
    communityPosts.set(post.id, post);
    return publicCommunityPost(post);
  };
  CommunityRepository.toggleLike = async ({ postId, userId, adminId }) => {
    const post = communityPosts.get(postId);
    if (!post || !["active", "approved"].includes(post.status)) {
      const { AppError } = require("../src/utils/AppError");
      throw new AppError(404, "POST_NOT_FOUND", "Post not found.");
    }
    const key = String(postId) + ":" + (userId ? "u" + userId : "a" + adminId);
    const liked = !likes.has(key);
    if (liked) likes.add(key);
    else likes.delete(key);
    return {
      liked,
      likes_count: Array.from(likes).filter((item) => item.startsWith(String(postId) + ":")).length,
    };
  };
  CommunityRepository.reportPost = async ({ postId, userId, adminId, reason }) => {
    const post = communityPosts.get(postId);
    if (!post || post.status === "removed") {
      const { AppError } = require("../src/utils/AppError");
      throw new AppError(404, "POST_NOT_FOUND", "Post not found.");
    }
    const existing = reports.some((report) =>
      report.post_id === postId &&
      (userId ? report.reporter_user_id === userId : report.reporter_admin_id === adminId));
    if (existing) {
      const { AppError } = require("../src/utils/AppError");
      throw new AppError(409, "ALREADY_REPORTED", "Already reported.");
    }
    reports.push({
      id: reports.length + 1,
      post_id: postId,
      reporter_user_id: userId,
      reporter_admin_id: adminId,
      reason,
      created_at: new Date().toISOString(),
    });
    post.status = "reported";
  };
  CommunityRepository.findPostOwner = async (id) => {
    const post = communityPosts.get(Number(id));
    return post ? { id: post.id, author_user_id: post.author_user_id, status: post.status } : null;
  };
  CommunityRepository.deletePost = async (id) => communityPosts.delete(Number(id));
  CommunityRepository.getUserPosts = async (id) =>
    Array.from(communityPosts.values())
      .filter((post) => post.author_user_id === Number(id))
      .map((post) => publicCommunityPost(post));
  CommunityRepository.getReportedPosts = async () =>
    reports.filter((report) => communityPosts.get(report.post_id)?.status === "reported")
      .map((report) => ({
        ...publicCommunityPost(communityPosts.get(report.post_id)),
        report_id: report.id,
        report_reason: report.reason,
      }));
  CommunityRepository.moderatePost = async (id, action) => {
    const post = communityPosts.get(Number(id));
    if (!post || post.status !== "reported") return null;
    post.status = action === "approve" ? "active" : "removed";
    return { id: post.id, content: post.content, status: post.status, created_at: post.created_at };
  };

  t.after(async () => {
    Object.assign(AdminRepository, {
      findByUsername: original.adminFindByUsername,
      findById: original.adminFindById,
    });
    Object.assign(BlogRepository, {
      findAll: original.blogFindAll,
      findBySlug: original.blogFindBySlug,
      incrementViews: original.blogIncrementViews,
      findById: original.blogFindById,
      create: original.blogCreate,
      update: original.blogUpdate,
      delete: original.blogDelete,
      getStats: original.blogGetStats,
    });
    Object.assign(CommunityUsersRepository, {
      findByUsername: original.userFindByUsername,
      findById: original.userFindById,
      create: original.userCreate,
      update: original.userUpdate,
    });
    Object.assign(CommunityRepository, {
      isUsernameTaken: original.commIsUsernameTaken,
      getPosts: original.commGetPosts,
      createPost: original.commCreatePost,
      toggleLike: original.commToggleLike,
      reportPost: original.commReportPost,
      findPostOwner: original.commFindPostOwner,
      deletePost: original.commDeletePost,
      getUserPosts: original.commGetUserPosts,
      getReportedPosts: original.commGetReportedPosts,
      moderatePost: original.commModeratePost,
    });
    await pool.end();
  });

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
  });

  const base = "http://127.0.0.1:" + server.address().port;
  const request = async (path, options = {}) => {
    const method = options.method || "GET";
    const headers = {};
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.token) headers.Authorization = "Bearer " + options.token;
    const response = await fetch(base + path, {
      method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    return { response, data: await response.json() };
  };

  const publicList = await request("/api/blog/posts?limit=10&publishedOnly=true");
  assert.equal(publicList.response.status, 200);
  assert.equal(publicList.data.posts.length, 1);

  const publicPost = await request("/api/blog/posts/public-post");
  assert.equal(publicPost.response.status, 200);
  assert.doesNotMatch(publicPost.data.post.content, /<script/i);
  assert.equal(blogPosts.get(1).views, 1);

  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: { username: "admin", password: "strong-admin-password" },
  });
  assert.equal(adminLogin.response.status, 200);
  const adminToken = adminLogin.data.token;
  const adminMe = await request("/api/auth/me", { token: adminToken });
  assert.equal(adminMe.response.status, 200);
  assert.equal(adminMe.data.admin.username, "admin");

  const anonymousDrafts = await request("/api/blog/posts?limit=10&publishedOnly=false");
  assert.equal(anonymousDrafts.response.status, 403);

  const createdBlog = await request("/api/blog/posts", {
    method: "POST",
    token: adminToken,
    body: { title: "A new draft", content: '<p>Draft</p><script>alert(1)</script>', published: false },
  });
  assert.equal(createdBlog.response.status, 201);
  const blogId = createdBlog.data.post.id;

  const draftList = await request("/api/blog/posts?limit=10&publishedOnly=false", { token: adminToken });
  assert.equal(draftList.response.status, 200);
  assert.ok(draftList.data.posts.some((post) => post.id === blogId));

  const adminDraft = await request("/api/blog/posts/id/" + blogId, { token: adminToken });
  assert.equal(adminDraft.response.status, 200);
  assert.doesNotMatch(adminDraft.data.post.content, /<script/i);
  assert.equal((await request("/api/blog/posts/a-new-draft")).response.status, 404);

  const updatedBlog = await request("/api/blog/posts/" + blogId, {
    method: "PUT",
    token: adminToken,
    body: { title: "Published draft", published: true },
  });
  assert.equal(updatedBlog.response.status, 200);
  assert.equal(updatedBlog.data.post.slug, "published-draft");
  assert.equal((await request("/api/blog/posts/published-draft")).response.status, 200);
  assert.equal((await request("/api/blog/stats", { token: adminToken })).data.posts, 2);

  const deletedBlog = await request("/api/blog/posts/" + blogId, { method: "DELETE", token: adminToken });
  assert.equal(deletedBlog.response.status, 200);
  assert.equal((await request("/api/blog/posts/published-draft")).response.status, 404);

  const register = await request("/api/community/auth/register", {
    method: "POST",
    body: {
      name: "Community User",
      username: "community-user",
      password: "strong-community-password",
      confirmPassword: "strong-community-password",
    },
  });
  assert.equal(register.response.status, 201);

  const userLogin = await request("/api/community/auth/login", {
    method: "POST",
    body: { username: "community-user", password: "strong-community-password" },
  });
  assert.equal(userLogin.response.status, 200);
  assert.equal(userLogin.data.role, "user");
  const userToken = userLogin.data.token;

  const me = await request("/api/community/auth/me", { token: userToken });
  assert.equal(me.response.status, 200);
  const userId = me.data.user.id;
  const profile = await request("/api/community/auth/profile", {
    method: "PUT",
    token: userToken,
    body: { name: "Updated User", avatar_url: "https://example.com/avatar.png" },
  });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.data.user.name, "Updated User");

  const createdCommunityPost = await request("/api/community/posts", {
    method: "POST",
    token: userToken,
    body: { content: "Hello community" },
  });
  assert.equal(createdCommunityPost.response.status, 201);
  const communityPostId = createdCommunityPost.data.post.id;

  const communityList = await request("/api/community/posts", { token: userToken });
  assert.equal(communityList.response.status, 200);
  assert.equal(communityList.data.posts[0].liked_by_me, false);

  const like = await request("/api/community/posts/" + communityPostId + "/like", { method: "POST", token: userToken });
  assert.equal(like.response.status, 200);
  assert.equal(like.data.liked, true);

  const duplicateLike = await request("/api/community/posts/" + communityPostId + "/like", { method: "POST", token: userToken });
  assert.equal(duplicateLike.response.status, 200);
  assert.equal(duplicateLike.data.liked, false);

  const userPosts = await request("/api/community/users/" + userId + "/posts", { token: userToken });
  assert.equal(userPosts.response.status, 200);
  assert.equal(userPosts.data.posts.length, 1);

  const report = await request("/api/community/posts/" + communityPostId + "/report", {
    method: "POST",
    token: userToken,
    body: { reason: "needs moderation" },
  });
  assert.equal(report.response.status, 200);

  const reportedForUser = await request("/api/community/admin/reports", { token: userToken });
  assert.equal(reportedForUser.response.status, 403);
  const reportsForAdmin = await request("/api/community/admin/reports", { token: adminToken });
  assert.equal(reportsForAdmin.response.status, 200);
  assert.equal(reportsForAdmin.data.posts.length, 1);

  const moderation = await request("/api/community/admin/posts/" + communityPostId + "/moderate", {
    method: "PUT",
    token: adminToken,
    body: { action: "approve" },
  });
  assert.equal(moderation.response.status, 200);
  assert.equal(moderation.data.post.status, "active");

  const deleteOwnPost = await request("/api/community/posts/" + communityPostId, { method: "DELETE", token: userToken });
  assert.equal(deleteOwnPost.response.status, 200);
  assert.equal((await request("/api/community/posts", { token: userToken })).data.posts.length, 0);
});
