"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const authFlex = require("../middleware/authFlex");
const requireUser = require("../middleware/requireUser");
const { validate } = require("../middleware/validate");
const authController = require("../controllers/communityAuthController");
const controller = require("../controllers/communityController");
const authSchemas = require("../validators/community-auth.validators");
const schemas = require("../validators/community.validators");
const router = express.Router();

function makeLimiter(limit, windowMs = 15 * 60_000) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ success: false, code: "RATE_LIMITED", message: "Too many requests." }),
  });
}

const authWriteLimiter = makeLimiter(10);
const communityWriteLimiter = makeLimiter(60);
const communityReadLimiter = makeLimiter(120, 60_000);
const adminOnly = (req, res, next) =>
  req.authUser?.role === "admin"
    ? next()
    : res.status(403).json({ success: false, code: "ADMIN_REQUIRED", message: "Acesso administrativo necessário." });

router.post("/auth/register", authWriteLimiter, validate(authSchemas.register), authController.register);
router.post("/auth/login", authWriteLimiter, validate(authSchemas.login), authController.loginUser);
router.get("/auth/me", authFlex, requireUser, authController.meUser);
router.put("/auth/profile", communityWriteLimiter, authFlex, requireUser, validate(authSchemas.updateProfile), authController.updateProfile);

router.get("/posts", communityReadLimiter, authFlex, validate(schemas.listQuery, "query"), controller.getPosts);
router.post("/posts", communityWriteLimiter, authFlex, requireUser, validate(schemas.createPost), controller.createPost);
router.delete("/posts/:id", communityWriteLimiter, authFlex, requireUser, validate(schemas.positiveId, "params"), controller.deletePost);
router.post("/posts/:id/like", communityWriteLimiter, authFlex, requireUser, validate(schemas.positiveId, "params"), controller.likePost);
router.post("/posts/:id/report", communityWriteLimiter, authFlex, requireUser, validate(schemas.positiveId, "params"), validate(schemas.reportPost), controller.reportPost);
router.get("/users/:id/posts", communityReadLimiter, authFlex, requireUser, validate(schemas.positiveId, "params"), controller.getUserPosts);
router.get("/admin/reports", communityReadLimiter, authFlex, requireUser, adminOnly, controller.getReportedPosts);
router.put("/admin/posts/:id/moderate", communityWriteLimiter, authFlex, requireUser, adminOnly, validate(schemas.positiveId, "params"), validate(schemas.moderatePost), controller.moderatePost);

module.exports = router;
