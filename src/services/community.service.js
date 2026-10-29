"use strict";

const CommunityRepository = require("../repositories/community.repository");
const { AppError } = require("../utils/AppError");

function positiveId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new AppError(400, "INVALID_ID", "Identificador inválido.");
  }
  return id;
}

function normalizeContent(value) {
  const content = typeof value === "string" ? value.trim() : "";
  if (!content || content.length > 500) {
    throw new AppError(400, "INVALID_POST", "A publicação deve ter entre 1 e 500 caracteres.");
  }
  return content;
}

async function listPosts({ limit, offset }, authUser) {
  const userId = authUser?.role === "user" ? Number(authUser.id) : null;
  const adminId = authUser?.role === "admin" ? Number(authUser.id) : null;
  return CommunityRepository.getPosts({
    limit,
    offset,
    userId: Number.isSafeInteger(userId) ? userId : null,
    adminId: Number.isSafeInteger(adminId) ? adminId : null,
  });
}

async function createPost(content, authUser) {
  const text = normalizeContent(content);
  const isAdminPost = authUser.role === "admin";
  return CommunityRepository.createPost({
    content: text,
    userId: isAdminPost ? null : positiveId(authUser.id),
    adminId: isAdminPost ? positiveId(authUser.id) : null,
    isAdminPost,
  });
}

async function toggleLike(rawId, authUser) {
  const postId = positiveId(rawId);
  const admin = authUser.role === "admin";
  return CommunityRepository.toggleLike({
    postId,
    userId: admin ? null : positiveId(authUser.id),
    adminId: admin ? positiveId(authUser.id) : null,
  });
}

async function reportPost(rawId, reason, authUser) {
  const postId = positiveId(rawId);
  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length > 1000) throw new AppError(400, "INVALID_REPORT", "Motivo da denúncia muito longo.");
  const admin = authUser.role === "admin";
  await CommunityRepository.reportPost({
    postId,
    userId: admin ? null : positiveId(authUser.id),
    adminId: admin ? positiveId(authUser.id) : null,
    reason: text || null,
  });
}

async function deletePost(rawId, authUser) {
  const postId = positiveId(rawId);
  const post = await CommunityRepository.findPostOwner(postId);
  if (!post) throw new AppError(404, "POST_NOT_FOUND", "Post não encontrado.");
  if (authUser.role === "user" && Number(post.author_user_id) !== Number(authUser.id)) {
    throw new AppError(403, "POST_DELETE_FORBIDDEN", "Você só pode excluir suas próprias publicações.");
  }
  await CommunityRepository.deletePost(postId);
}

async function getUserPosts(rawId, authUser) {
  const requestedId = authUser.role === "admin" ? positiveId(rawId) : positiveId(authUser.id);
  if (authUser.role === "user" && requestedId !== Number(authUser.id)) {
    throw new AppError(403, "PROFILE_ACCESS_FORBIDDEN", "Acesso negado.");
  }
  return CommunityRepository.getUserPosts(requestedId);
}

async function getReportedPosts() {
  const posts = await CommunityRepository.getReportedPosts();
  return { posts, total: posts.length };
}

async function moderatePost(rawId, action) {
  const postId = positiveId(rawId);
  if (!["approve", "remove"].includes(action)) {
    throw new AppError(400, "INVALID_MODERATION_ACTION", "Ação de moderação inválida.");
  }
  const post = await CommunityRepository.moderatePost(postId, action);
  if (!post) throw new AppError(404, "REPORT_NOT_FOUND", "Denúncia não encontrada.");
  return post;
}

module.exports = {
  listPosts,
  createPost,
  toggleLike,
  reportPost,
  deletePost,
  getUserPosts,
  getReportedPosts,
  moderatePost,
};
