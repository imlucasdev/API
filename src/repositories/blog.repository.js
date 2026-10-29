"use strict";

const { pool } = require("../config/database");

class BlogRepository {
  static async findById(id) {
    const result = await pool.query("SELECT * FROM blog_posts WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  static async findAll({ limit = 10, offset = 0, publishedOnly = true } = {}) {
    const where = publishedOnly ? "WHERE published = TRUE" : "";
    const result = await pool.query(
      `SELECT id, title, slug, excerpt, cover_image, author_id, published, views, created_at, published_at
       FROM blog_posts ${where}
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return result.rows;
  }

  static async findBySlug(slug) {
    const result = await pool.query(
      `SELECT id, title, slug, content, excerpt, cover_image, author_id, published, views, created_at, published_at
       FROM blog_posts WHERE slug = $1`,
      [slug],
    );
    return result.rows[0] || null;
  }

  static async create(data) {
    const { title, slug, content, excerpt = null, cover_image = null, author_id, published = false } = data;
    const result = await pool.query(
      `INSERT INTO blog_posts (title, slug, content, excerpt, cover_image, author_id, published, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $7 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END)
       RETURNING id, title, slug, excerpt, cover_image, published, created_at, published_at`,
      [title, slug, content, excerpt, cover_image, author_id, published],
    );
    return result.rows[0];
  }

  static async update(id, data) {
    const allowed = ["title", "slug", "content", "excerpt", "cover_image", "published"];
    const entries = Object.entries(data).filter(([key, value]) => allowed.includes(key) && value !== undefined);
    if (!entries.length) return this.findById(id);

    const values = [id];
    const assignments = entries.map(([key, value], index) => {
      values.push(value);
      return `${key} = $${index + 2}`;
    });
    const publishedEntry = entries.find(([key]) => key === "published");
    if (publishedEntry) {
      values.push(publishedEntry[1]);
      assignments.push(
        `published_at = CASE WHEN $${values.length}::boolean = TRUE AND published = FALSE THEN CURRENT_TIMESTAMP ELSE published_at END`,
      );
    }

    const result = await pool.query(
      `UPDATE blog_posts SET ${assignments.join(", ")}
       WHERE id = $1
       RETURNING id, title, slug, excerpt, cover_image, published, created_at, published_at`,
      values,
    );
    return result.rows[0] || null;
  }

  static async delete(id) {
    const result = await pool.query("DELETE FROM blog_posts WHERE id = $1", [id]);
    return result.rowCount > 0;
  }

  static async incrementViews(slug) {
    await pool.query("UPDATE blog_posts SET views = views + 1 WHERE slug = $1 AND published = TRUE", [slug]);
  }

  static async getStats() {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE published = TRUE)::int AS published_count,
              COALESCE(SUM(views), 0)::bigint AS total_views
       FROM blog_posts`,
    );
    return {
      posts: Number(result.rows[0].total),
      published: Number(result.rows[0].published_count),
      views: Number(result.rows[0].total_views),
    };
  }
}

module.exports = BlogRepository;
