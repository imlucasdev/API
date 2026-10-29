"use strict";

const { pool } = require("../config/database");

class AdminRepository {
  static async findByUsername(username) {
    const result = await pool.query(
      "SELECT id, username, password_hash FROM admins WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [username],
    );
    return result.rows[0] || null;
  }

  static async findById(id) {
    const result = await pool.query(
      "SELECT id, username, created_at FROM admins WHERE id = $1",
      [id],
    );
    return result.rows[0] || null;
  }

  static async create(username, passwordHash) {
    const result = await pool.query(
      "INSERT INTO admins (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at",
      [username, passwordHash],
    );
    return result.rows[0];
  }

  static async updatePassword(id, newHash) {
    await pool.query(
      "UPDATE admins SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [newHash, id],
    );
  }
}

module.exports = AdminRepository;
