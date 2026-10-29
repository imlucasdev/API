"use strict";

const { z } = require("zod");

const username = z.string().trim().min(3).max(50).regex(/^[A-Za-z0-9_.-]+$/);
const password = z.string().min(1).max(1024);

const register = z.object({
  name: z.string().trim().min(1).max(100),
  username,
  password: z.string().min(8).max(72).refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must be at most 72 bytes.",
  ),
  confirmPassword: z.string().min(1).max(72),
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

const login = z.object({ username: z.string().trim().min(1).max(50), password });
const updateProfile = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  username: username.optional(),
  avatar_url: z.string().trim().max(2048).optional().nullable(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field is required.",
});

module.exports = { register, login, updateProfile };
