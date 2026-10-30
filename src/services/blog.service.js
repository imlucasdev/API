"use strict";

const BlogRepository = require("../repositories/blog.repository");
const { slugify } = require("../utils/helpers");
const { sanitizePostHtml } = require("../utils/sanitizePostHtml");
const { AppError } = require("../utils/AppError");

async function listPosts({ limit, offset, publishedOnly = true }, authUser = null) {
  if (!publishedOnly && authUser?.role !== "admin") {
    throw new AppError(403, "ADMIN_REQUIRED", "Acesso administrativo necessário.");
  }
  return BlogRepository.findAll({ limit, offset, publishedOnly });
}

async function getPublishedPost(slug) {
  const post = await BlogRepository.findBySlug(slug);
  if (!post || !post.published) {
    throw new AppError(404, "POST_NOT_FOUND", "Post não encontrado.");
  }
  await BlogRepository.incrementViews(slug);
  return { ...post, content: sanitizePostHtml(post.content) };
}

async function getPostForAdmin(id) {
  const post = await BlogRepository.findById(id);
  if (!post) throw new AppError(404, "POST_NOT_FOUND", "Post não encontrado.");
  return { ...post, content: sanitizePostHtml(post.content) };
}

async function getStats() {
  return BlogRepository.getStats();
}

async function createPost(input, authorId) {
  const slug = slugify(input.title);
  if (!slug) throw new AppError(400, "INVALID_TITLE", "Título inválido.");
  try {
    return await BlogRepository.create({
      ...input,
      slug,
      content: sanitizePostHtml(input.content),
      author_id: authorId,
    });
  } catch (error) {
    if (error?.code === "23505") {
      throw new AppError(409, "POST_SLUG_CONFLICT", "Já existe uma publicação com esse título.");
    }
    throw error;
  }
}

async function updatePost(id, input) {
  const changes = { ...input };
  if (Object.prototype.hasOwnProperty.call(changes, "title")) {
    changes.slug = slugify(changes.title);
    if (!changes.slug) throw new AppError(400, "INVALID_TITLE", "Título inválido.");
  }
  if (Object.prototype.hasOwnProperty.call(changes, "content")) {
    changes.content = sanitizePostHtml(changes.content);
  }

  try {
    const post = await BlogRepository.update(id, changes);
    if (!post) throw new AppError(404, "POST_NOT_FOUND", "Post não encontrado.");
    return post;
  } catch (error) {
    if (error?.code === "23505") {
      throw new AppError(409, "POST_SLUG_CONFLICT", "Já existe uma publicação com esse título.");
    }
    throw error;
  }
}

async function deletePost(id) {
  const deleted = await BlogRepository.delete(id);
  if (!deleted) throw new AppError(404, "POST_NOT_FOUND", "Post não encontrado.");
}

module.exports = {
  listPosts,
  getPublishedPost,
  getPostForAdmin,
  getStats,
  createPost,
  updatePost,
  deletePost,
};
