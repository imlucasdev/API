"use strict";

const jwt = require("jsonwebtoken");
const AdminRepository = require("../repositories/admin.repository");
const { env } = require("../config/env");

module.exports = async (req, res, next) => {
  const header = req.get("authorization");
  if (typeof header !== "string" || !/^Bearer\\s+\\S+$/i.test(header)) {
    return res.status(401).json({
      success: false,
      code: "AUTH_REQUIRED",
      message: "Autenticação necessária.",
    });
  }

  let decoded;
  try {
    const token = header.replace(/^Bearer\\s+/i, "").trim();
    decoded = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json({
      success: false,
      code: "INVALID_SESSION",
      message: "Sessão inválida ou expirada.",
    });
  }

  const id = Number(decoded?.id);
  if (
    !decoded ||
    typeof decoded !== "object" ||
    decoded.role !== "admin" ||
    !Number.isSafeInteger(id) ||
    id < 1
  ) {
    return res.status(403).json({
      success: false,
      code: "ADMIN_REQUIRED",
      message: "Acesso administrativo necessário.",
    });
  }

  try {
    const admin = await AdminRepository.findById(id);
    if (!admin) {
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        message: "Sessão inválida ou expirada.",
      });
    }

    req.user = { id: admin.id, username: admin.username, role: "admin" };
    req.admin = req.user;
    return next();
  } catch (error) {
    return next(error);
  }
};
