"use strict";

const { z } = require("zod");

const positiveId = z.object({ id: z.coerce.number().int().positive() });
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
const createPost = z.object({
  content: z.string().trim().min(1).max(500),
});
const reportPost = z.object({
  reason: z.string().trim().max(1000).optional().default(""),
});
const moderatePost = z.object({
  action: z.enum(["approve", "remove"]),
});

module.exports = { positiveId, listQuery, createPost, reportPost, moderatePost };
