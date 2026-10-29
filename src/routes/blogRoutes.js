"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const authMiddleware = require("../middleware/auth");
const authFlex = require("../middleware/authFlex");
const { validate } = require("../middleware/validate");
const controller = require("../controllers/blogController");
const {
  blogListQuery,
  createBlogPost,
  updateBlogPost,
  idParams,
  slugParams,
} = require("../validators/blog.validators");

const router = express.Router();
const readLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
const writeLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/posts", readLimiter, authFlex, validate(blogListQuery, "query"), controller.list);
router.get("/posts/:slug", readLimiter, validate(slugParams, "params"), controller.getPublished);
router.get("/stats", authMiddleware, controller.stats);
router.post("/posts", authMiddleware, writeLimiter, validate(createBlogPost), controller.create);
router.get("/posts/id/:id", authMiddleware, validate(idParams, "params"), controller.getForAdmin);
router.put("/posts/:id", authMiddleware, writeLimiter, validate(idParams, "params"), validate(updateBlogPost), controller.update);
router.delete("/posts/:id", authMiddleware, writeLimiter, validate(idParams, "params"), controller.remove);

module.exports = router;
