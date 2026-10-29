"use strict";

const { z } = require("zod");

const positiveId = z.coerce.number().int().positive();
const slug = z.string().trim().min(1).max(180).regex(/^[a-z0-9_-]+$/);
const coverImage = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    if (value.startsWith("/") && !value.startsWith("//")) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Invalid cover image URL.")
  .optional()
  .nullable();

const title = z.string().trim().min(1).max(180);
const content = z.string().min(1).max(80_000);
const excerpt = z.string().trim().max(500).optional().nullable();

const blogListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  publishedOnly: z.enum(["true", "false"]).default("true").transform((value) => value !== "false"),
});

const createBlogPost = z.object({
  title,
  content,
  excerpt,
  cover_image: coverImage,
  published: z.boolean().default(false),
});

const updateBlogPost = z.object({
  title: title.optional(),
  content: content.optional(),
  excerpt,
  cover_image: coverImage,
  published: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required.",
);

const idParams = z.object({ id: positiveId });
const slugParams = z.object({ slug });

module.exports = {
  blogListQuery,
  createBlogPost,
  updateBlogPost,
  idParams,
  slugParams,
};
