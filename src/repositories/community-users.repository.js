"use strict";

const { pool } = require("../config/database");

class CommunityUsersRepository {
  static async findByUsername(username) {
    const result = await pool.query(
      `SELECT id, registration_number, name, username, password_hash, avatar_url, created_at, updated_at
       FROM community_users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [username],
    );
    return result.rows[0] || null;
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT id, registration_number, name, username, avatar_url, created_at, updated_at
       FROM community_users WHERE id = $1`,
      [id],
    );
    return result.rows[0] || null;
  }

  static async create({ name, username, passwordHash }) {
    const result = await pool.query(
      `INSERT INTO community_users(name, username, password_hash)
       VALUES($1, $2, $3)
       RETURNING id, registration_number, name, username, avatar_url, created_at, updated_at`,
      [name, username, passwordHash],
    );
    return result.rows[0];
  }

  static async update(id, fields) {
    const allowed = ["name", "username", "avatar_url"];
    const entries = Object.entries(fields).filter(([key, value]) => allowed.includes(key) && value !== undefined);
    if (!entries.length) return this.findById(id);
    const values = [id];
    const sets = entries.map(([key, value], index) => {
      values.push(value);
      return `${key} = $${index + 2}`;
    });
    const result = await pool.query(
      `UPDATE community_users SET ${sets.join(", ")}, updated_at = NOW()
       WHERE id = $1
       RETURNING id, registration_number, name, username, avatar_url, created_at, updated_at`,
      values,
    );
    return result.rows[0] || null;
  }
}

module.exports = CommunityUsersRepository;
