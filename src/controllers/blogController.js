"use strict";

const BlogService = require("../services/blog.service");

exports.list = async (req, res, next) => {
  try {
    const { limit, offset, publishedOnly } = req.validated.query;
    const posts = await BlogService.listPosts(
      { limit, offset, publishedOnly },
      req.authUser,
    );
    return res.json({ success: true, posts });
  } catch (error) {
    return next(error);
  }
};

exports.getPublished = async (req, res, next) => {
  try {
    const post = await BlogService.getPublishedPost(req.validated.params.slug);
    return res.json({ success: true, post });
  } catch (error) {
    return next(error);
  }
};

exports.getForAdmin = async (req, res, next) => {
  try {
    const post = await BlogService.getPostForAdmin(req.validated.params.id);
    return res.json({ success: true, post });
  } catch (error) {
    return next(error);
  }
};

exports.stats = async (_req, res, next) => {
  try {
    return res.json(await BlogService.getStats());
  } catch (error) {
    return next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    const post = await BlogService.createPost(req.validated.body, req.admin.id);
    return res.status(201).json({ success: true, post });
  } catch (error) {
    return next(error);
  }
};

exports.update = async (req, res, next) => {
  try {
    const post = await BlogService.updatePost(req.validated.params.id, req.validated.body);
    return res.json({ success: true, post });
  } catch (error) {
    return next(error);
  }
};

exports.remove = async (req, res, next) => {
  try {
    await BlogService.deletePost(req.validated.params.id);
    return res.json({ success: true, message: "Post deleted successfully." });
  } catch (error) {
    return next(error);
  }
};
