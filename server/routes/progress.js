import express from "express";
import pool from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Get all progress for user
router.get("/", authenticateToken, async (req, res) => {
  try {
    const progress = (await pool.query(`
      SELECT rp.*, b.title, b.author, b.cover_url, b.pages, b.genre, b.rating,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = $1
      ORDER BY rp.last_read DESC
    `, [req.user.id])).rows;
    res.json({ progress });
  } catch (e) {
    console.error("Get progress:", e);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

// Update or create progress
router.put("/:bookId", authenticateToken, async (req, res) => {
  try {
    const { currentChapter, progressPercent } = req.body;
    const bookId = parseInt(req.params.bookId);
    const userId = req.user.id;

    const existing = (await pool.query("SELECT id, streak_days FROM reading_progress WHERE user_id=$1 AND book_id=$2", [userId, bookId])).rows[0];

    if (existing) {
      await pool.query(
        "UPDATE reading_progress SET current_chapter=$1, progress_percent=$2, streak_days=streak_days+1, last_read=NOW() WHERE id=$3",
        [currentChapter || 1, progressPercent || 0, existing.id]
      );
    } else {
      await pool.query(
        "INSERT INTO reading_progress (user_id, book_id, current_chapter, progress_percent, streak_days) VALUES ($1,$2,$3,$4,1)",
        [userId, bookId, currentChapter || 1, progressPercent || 0]
      );
    }

    const updated = (await pool.query(`
      SELECT rp.*, b.title, b.author, b.cover_url,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM reading_progress rp JOIN books b ON b.id=rp.book_id
      WHERE rp.user_id=$1 AND rp.book_id=$2
    `, [userId, bookId])).rows[0];

    res.json({ message: "Progress updated", progress: updated });
  } catch (e) {
    console.error("Update progress:", e);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

// Delete progress (remove book from reading list)
router.delete("/:bookId", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM reading_progress WHERE user_id=$1 AND book_id=$2", [req.user.id, parseInt(req.params.bookId)]);
    res.json({ message: "Removed from reading list" });
  } catch (e) {
    console.error("Delete progress:", e);
    res.status(500).json({ error: "Failed to remove" });
  }
});

export default router;
