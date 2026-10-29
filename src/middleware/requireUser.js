"use strict";

module.exports = (req, res, next) => {
  if (!req.authUser || !["user", "admin"].includes(req.authUser.role)) {
    return res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      message: "Login required.",
    });
  }
  return next();
};
