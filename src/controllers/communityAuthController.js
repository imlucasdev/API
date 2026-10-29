"use strict";

const CommunityAuthService = require("../services/community-auth.service");

exports.register = async (req, res, next) => {
  try {
    const user = await CommunityAuthService.registerUser(req.validated.body);
    return res.status(201).json({ success: true, user });
  } catch (error) {
    return next(error);
  }
};

exports.loginUser = async (req, res, next) => {
  try {
    return res.json(await CommunityAuthService.login(
      req.validated.body.username,
      req.validated.body.password,
    ));
  } catch (error) {
    return next(error);
  }
};

exports.meUser = async (req, res, next) => {
  try {
    return res.json({ success: true, ...(await CommunityAuthService.getCurrentAccount(req.authUser)) });
  } catch (error) {
    return next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await CommunityAuthService.updateProfile(req.authUser, req.validated.body);
    return res.json({ success: true, user });
  } catch (error) {
    return next(error);
  }
};
