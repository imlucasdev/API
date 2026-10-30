"use strict";

const jwt = require("jsonwebtoken");
const AdminRepository = require("../repositories/admin.repository");
const CommunityUsersRepository = require("../repositories/community-users.repository");
const { env } = require("../config/env");

function getBearerToken(req) {
  const header = req.get("authorization");
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

module.exports = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    req.authUser = null;
    req.user = null;
    return next();
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    req.authUser = null;
    req.user = null;
    return next();
  }

  const id = Number(decoded?.id);
  if (!decoded || typeof decoded !== "object" || !Number.isSafeInteger(id) || id < 1) {
    req.authUser = null;
    req.user = null;
    return next();
  }

  try {
    let identity = null;
    if (decoded.role === "user") {
      const user = await CommunityUsersRepository.findById(id);
      if (user) identity = { id: user.id, username: user.username, role: "user" };
    } else if (decoded.role === "admin" || !decoded.role) {
      const admin = await AdminRepository.findById(id);
      if (admin) identity = { id: admin.id, username: admin.username, role: "admin" };
    }

    req.authUser = identity;
    req.user = identity;
    return next();
  } catch (error) {
    return next(error);
  }
};
