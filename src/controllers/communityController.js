"use strict";

const CommunityService = require("../services/community.service");

exports.getPosts = async (req, res, next) => {
  try {
    const limit = req.validated?.query?.limit ?? 20;
    const offset = req.validated?.query?.offset ?? 0;
    const result = await CommunityService.listPosts({ limit, offset }, req.authUser);
    return res.json({ success: true, ...result, limit, offset });
  } catch (error) {
    return next(error);
  }
};

exports.createPost = async (req, res, next) => {
  try {
    const post = await CommunityService.createPost(req.validated.body.content, req.authUser);
    return res.status(201).json({ success: true, post });
  } catch (error) {
    return next(error);
  }
};

exports.likePost = async (req, res, next) => {
  try {
    const result = await CommunityService.toggleLike(req.validated.params.id, req.authUser);
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

exports.reportPost = async (req, res, next) => {
  try {
    await CommunityService.reportPost(
      req.validated.params.id,
      req.validated.body.reason,
      req.authUser,
    );
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    await CommunityService.deletePost(req.validated.params.id, req.authUser);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
};

exports.getUserPosts = async (req, res, next) => {
  try {
    const posts = await CommunityService.getUserPosts(req.validated.params.id, req.authUser);
    return res.json({ success: true, posts });
  } catch (error) {
    return next(error);
  }
};

exports.getReportedPosts = async (_req, res, next) => {
  try {
    return res.json({ success: true, ...(await CommunityService.getReportedPosts()) });
  } catch (error) {
    return next(error);
  }
};

exports.moderatePost = async (req, res, next) => {
  try {
    const post = await CommunityService.moderatePost(
      req.validated.params.id,
      req.validated.body.action,
    );
    return res.json({ success: true, post });
  } catch (error) {
    return next(error);
  }
};
