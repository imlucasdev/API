"use strict";

const { pool } = require("../config/database");
const { AppError } = require("../utils/AppError");

const publicPostFields = `
  p.id, p.content, p.author_user_id, p.author_admin_id, p.is_admin_post, p.status, p.created_at,
  COALESCE(u.name, a.username) AS author_name,
  COALESCE(u.username, a.username) AS author_username,
  u.registration_number, u.avatar_url
`;

class CommunityRepository {
  static async getPosts({ limit, offset, userId, adminId }) {
    const [posts, count] = await Promise.all([
      pool.query(
        `SELECT ${publicPostFields},
                COUNT(DISTINCT l.id)::int AS likes_count,
                EXISTS (
                  SELECT 1 FROM community_likes cl
                  WHERE cl.post_id = p.id
                    AND ((cl.user_id = $3 AND $3 IS NOT NULL) OR (cl.admin_id = $4 AND $4 IS NOT NULL))
                ) AS liked_by_me
         FROM community_posts p
         LEFT JOIN community_users u ON p.author_user_id = u.id
         LEFT JOIN admins a ON p.author_admin_id = a.id
         LEFT JOIN community_likes l ON l.post_id = p.id
         WHERE p.status IN ('active', 'approved')
         GROUP BY p.id, u.name, u.username, u.registration_number, u.avatar_url, a.username
         ORDER BY p.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset, userId, adminId],
      ),
      pool.query(
        "SELECT COUNT(*)::int AS total FROM community_posts WHERE status IN ('active', 'approved')",
      ),
    ]);
    return { posts: posts.rows, total: count.rows[0].total };
  }

  static async createPost({ content, userId, adminId, isAdminPost }) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO community_posts(content, author_user_id, author_admin_id, is_admin_post)
         VALUES($1, $2, $3, $4) RETURNING id`,
        [content, userId, adminId, isAdminPost],
      );
      const result = await client.query(
        `SELECT ${publicPostFields}, 0::int AS likes_count, FALSE AS liked_by_me
         FROM community_posts p
         LEFT JOIN community_users u ON p.author_user_id = u.id
         LEFT JOIN admins a ON p.author_admin_id = a.id
         WHERE p.id = $1`,
        [inserted.rows[0].id],
      );
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  static async toggleLike({ postId, userId, adminId }) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const post = await client.query(
        "SELECT id FROM community_posts WHERE id = $1 AND status IN ('active', 'approved') FOR UPDATE",
        [postId],
      );
      if (!post.rowCount) throw new AppError(404, "POST_NOT_FOUND", "Post não encontrado.");

      const current = await client.query(
        `SELECT id FROM community_likes
         WHERE post_id = $1
           AND ((user_id = $2 AND $2 IS NOT NULL) OR (admin_id = $3 AND $3 IS NOT NULL))
         LIMIT 1`,
        [postId, userId, adminId],
      );

      let liked;
      if (current.rowCount) {
        await client.query("DELETE FROM community_likes WHERE id = $1", [current.rows[0].id]);
        liked = false;
      } else {
        await client.query(
          "INSERT INTO community_likes(post_id, user_id, admin_id) VALUES($1, $2, $3)",
          [postId, userId, adminId],
        );
        liked = true;
      }

      const count = await client.query(
        "SELECT COUNT(*)::int AS likes_count FROM community_likes WHERE post_id = $1",
        [postId],
      );
      await client.query("COMMIT");
      return { liked, likes_count: count.rows[0].likes_count };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  static async reportPost({ postId, userId, adminId, reason }) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const post = await client.query(
        "SELECT status FROM community_posts WHERE id = $1 FOR UPDATE",
        [postId],
      );
      if (!post.rowCount || post.rows[0].status === "removed") {
        throw new AppError(404, "POST_NOT_FOUND", "Post não encontrado.");
      }

      const existing = await client.query(
        `SELECT id FROM community_reports
         WHERE post_id = $1
           AND ((reporter_user_id = $2 AND $2 IS NOT NULL) OR (reporter_admin_id = $3 AND $3 IS NOT NULL))
         LIMIT 1`,
        [postId, userId, adminId],
      );
      if (existing.rowCount) {
        throw new AppError(409, "ALREADY_REPORTED", "Você já denunciou esta publicação.");
      }

      await client.query(
        "INSERT INTO community_reports(post_id, reporter_user_id, reporter_admin_id, reason) VALUES($1, $2, $3, $4)",
        [postId, userId, adminId, reason],
      );
      if (post.rows[0].status === "active" || post.rows[0].status === "approved") {
        await client.query("UPDATE community_posts SET status = 'reported' WHERE id = $1", [postId]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  static async findPostOwner(postId) {
    const result = await pool.query(
      "SELECT id, author_user_id, status FROM community_posts WHERE id = $1",
      [postId],
    );
    return result.rows[0] || null;
  }

  static async deletePost(postId) {
    const result = await pool.query("DELETE FROM community_posts WHERE id = $1", [postId]);
    return result.rowCount > 0;
  }

  static async getUserPosts(userId) {
    const result = await pool.query(
      `SELECT ${publicPostFields}, COUNT(DISTINCT l.id)::int AS likes_count
       FROM community_posts p
       LEFT JOIN community_users u ON p.author_user_id = u.id
       LEFT JOIN admins a ON p.author_admin_id = a.id
       LEFT JOIN community_likes l ON l.post_id = p.id
       WHERE p.author_user_id = $1
       GROUP BY p.id, u.name, u.username, u.registration_number, u.avatar_url, a.username
       ORDER BY p.created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  static async getReportedPosts() {
    const result = await pool.query(
      `SELECT ${publicPostFields},
              cr.id AS report_id, cr.reason AS report_reason, cr.created_at AS reported_at,
              COALESCE(ru.name, ra.username) AS reporter_name,
              COALESCE(ru.username, ra.username) AS reporter_username,
              ru.registration_number AS reporter_registration_number
       FROM community_posts p
       LEFT JOIN community_users u ON p.author_user_id = u.id
       LEFT JOIN admins a ON p.author_admin_id = a.id
       JOIN community_reports cr ON cr.post_id = p.id
       LEFT JOIN community_users ru ON cr.reporter_user_id = ru.id
       LEFT JOIN admins ra ON cr.reporter_admin_id = ra.id
       WHERE p.status = 'reported'
       ORDER BY cr.created_at DESC
       LIMIT 500`,
    );
    return result.rows;
  }

  static async moderatePost(postId, action) {
    const result = await pool.query(
      `UPDATE community_posts
       SET status = $1
       WHERE id = $2 AND status = 'reported'
       RETURNING id, content, status, created_at`,
      [action === "approve" ? "active" : "removed", postId],
    );
    return result.rows[0] || null;
  }

  static async isUsernameTaken(username, excludeId = null) {
    const result = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM community_users
         WHERE LOWER(username) = LOWER($1) AND ($2::int IS NULL OR id <> $2)
       ) OR EXISTS (
         SELECT 1 FROM admins WHERE LOWER(username) = LOWER($1)
       ) AS taken`,
      [username, excludeId],
    );
    return Boolean(result.rows[0]?.taken);
  }
}

module.exports = CommunityRepository;
