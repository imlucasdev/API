"use strict";

const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AdminRepository = require("../repositories/admin.repository");
const { env } = require("../config/env");
const { AppError } = require("../utils/AppError");

const dummyHashPromise = bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);

async function loginAdmin(username, password) {
  const admin = await AdminRepository.findByUsername(username);
  const hash = admin ? admin.password_hash : await dummyHashPromise;
  let valid = false;

  try {
    valid = await bcrypt.compare(password, hash);
  } catch {
    valid = false;
  }

  if (!admin || !valid) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Credenciais inválidas.");
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: "admin" },
    env.jwtSecret,
    { algorithm: "HS256", expiresIn: "7d" },
  );

  return {
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      created_at: admin.created_at,
    },
  };
}

async function getAdmin(id) {
  const admin = await AdminRepository.findById(id);
  if (!admin) throw new AppError(404, "ADMIN_NOT_FOUND", "Administrador não encontrado.");
  return admin;
}

module.exports = { loginAdmin, getAdmin };
