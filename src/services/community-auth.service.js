"use strict";

const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const AdminRepository = require("../repositories/admin.repository");
const CommunityUsersRepository = require("../repositories/community-users.repository");
const CommunityRepository = require("../repositories/community.repository");
const { env } = require("../config/env");
const { AppError } = require("../utils/AppError");

const decoyHashPromise = bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
const usernamePattern = /^[A-Za-z0-9_.-]{3,50}$/;

function publicUser(user) {
  return {
    id: user.id,
    registration_number: user.registration_number,
    name: user.name,
    username: user.username,
    avatar_url: user.avatar_url || null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

function publicAdmin(admin) {
  return {
    id: admin.id,
    username: admin.username,
    created_at: admin.created_at,
  };
}

function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { algorithm: "HS256", expiresIn: "7d" });
}

async function registerUser({ name, username, password, confirmPassword }) {
  const normalizedName = String(name || "").trim();
  const normalizedUsername = String(username || "").trim();
  if (!normalizedName || normalizedName.length > 100) {
    throw new AppError(400, "INVALID_NAME", "Nome inválido.");
  }
  if (!usernamePattern.test(normalizedUsername)) {
    throw new AppError(400, "INVALID_USERNAME", "Nome de usuário inválido.");
  }
  if (password !== confirmPassword) {
    throw new AppError(400, "PASSWORD_MISMATCH", "As senhas não coincidem.");
  }
  if (
    typeof password !== "string" ||
    Buffer.byteLength(password, "utf8") < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new AppError(400, "INVALID_PASSWORD", "A senha deve ter entre 8 e 72 bytes.");
  }
  if (await CommunityRepository.isUsernameTaken(normalizedUsername)) {
    throw new AppError(409, "USERNAME_TAKEN", "Este nome de usuário já está em uso.");
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await CommunityUsersRepository.create({
      name: normalizedName,
      username: normalizedUsername,
      passwordHash,
    });
    return publicUser(user);
  } catch (error) {
    if (error?.code === "23505") {
      throw new AppError(409, "USERNAME_TAKEN", "Este nome de usuário já está em uso.");
    }
    throw error;
  }
}

async function login(username, password) {
  const normalizedUsername = String(username || "").trim();
  const user = await CommunityUsersRepository.findByUsername(normalizedUsername);
  if (user) {
    let valid = false;
    try {
      valid = await bcrypt.compare(password, user.password_hash);
    } catch {
      valid = false;
    }
    if (!valid) throw new AppError(401, "INVALID_CREDENTIALS", "Credenciais inválidas.");
    const safeUser = publicUser(user);
    return {
      success: true,
      token: signToken({
        id: safeUser.id,
        username: safeUser.username,
        role: "user",
        registration_number: safeUser.registration_number,
      }),
      role: "user",
      user: safeUser,
    };
  }

  const admin = await AdminRepository.findByUsername(normalizedUsername);
  let validAdmin = false;
  try {
    validAdmin = await bcrypt.compare(password, admin ? admin.password_hash : await decoyHashPromise);
  } catch {
    validAdmin = false;
  }
  if (!admin || !validAdmin) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Credenciais inválidas.");
  }

  return {
    success: true,
    token: signToken({ id: admin.id, username: admin.username, role: "admin" }),
    role: "admin",
    admin: publicAdmin(admin),
  };
}

async function getCurrentAccount(authUser) {
  const id = Number(authUser?.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new AppError(401, "INVALID_SESSION", "Sessão inválida.");
  }
  if (authUser.role === "admin") {
    const admin = await AdminRepository.findById(id);
    if (!admin) throw new AppError(401, "INVALID_SESSION", "Sessão inválida.");
    return { role: "admin", admin };
  }
  if (authUser.role !== "user") throw new AppError(401, "INVALID_SESSION", "Sessão inválida.");
  const user = await CommunityUsersRepository.findById(id);
  if (!user) throw new AppError(401, "INVALID_SESSION", "Sessão inválida.");
  return { role: "user", user };
}

async function updateProfile(authUser, input) {
  if (authUser?.role !== "user") {
    throw new AppError(403, "PROFILE_UPDATE_FORBIDDEN", "Apenas usuários da comunidade podem editar este perfil.");
  }
  const id = Number(authUser.id);
  const changes = {};

  if (input.name !== undefined) {
    changes.name = input.name.trim();
    if (!changes.name || changes.name.length > 100) {
      throw new AppError(400, "INVALID_NAME", "Nome inválido.");
    }
  }
  if (input.username !== undefined) {
    changes.username = input.username.trim();
    if (!usernamePattern.test(changes.username)) {
      throw new AppError(400, "INVALID_USERNAME", "Nome de usuário inválido.");
    }
    if (await CommunityRepository.isUsernameTaken(changes.username, id)) {
      throw new AppError(409, "USERNAME_TAKEN", "Este nome de usuário já está em uso.");
    }
  }
  if (input.avatar_url !== undefined) {
    const avatar = String(input.avatar_url || "").trim();
    if (!avatar) {
      changes.avatar_url = null;
    } else {
      let url;
      try {
        url = new URL(avatar);
      } catch {
        throw new AppError(400, "INVALID_AVATAR_URL", "A URL do avatar é inválida.");
      }
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new AppError(400, "INVALID_AVATAR_URL", "Use uma URL HTTPS válida para o avatar.");
      }
      changes.avatar_url = url.href;
    }
  }

  try {
    const user = await CommunityUsersRepository.update(id, changes);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "Usuário não encontrado.");
    return publicUser(user);
  } catch (error) {
    if (error?.code === "23505") {
      throw new AppError(409, "USERNAME_TAKEN", "Este nome de usuário já está em uso.");
    }
    throw error;
  }
}

module.exports = { registerUser, login, getCurrentAccount, updateProfile };
