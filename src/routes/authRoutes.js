"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const { login, me } = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { z } = require("zod");

const router = express.Router();
const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(1024),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ success: false, code: "RATE_LIMITED", message: "Too many login attempts." }),
});

router.post("/login", loginLimiter, validate(loginSchema), login);
router.get("/me", authMiddleware, me);

module.exports = router;
