"use strict";

const AuthService = require("../services/auth.service");

exports.login = async (req, res, next) => {
  try {
    const result = await AuthService.loginAdmin(req.validated.body.username, req.validated.body.password);
    return res.json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    const admin = await AuthService.getAdmin(req.admin.id);
    return res.json({ success: true, admin });
  } catch (error) {
    return next(error);
  }
};
