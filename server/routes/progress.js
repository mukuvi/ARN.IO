import express from "express";
import db from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Get all progress for user
router.get("/", authenticateToken, (req, res) => {
  try {
    const progress = db.prepare(`
      SELECT rp.*, b.title, b.author, b.cover_url, b.pages, b.genre, b.rating,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = ?
      ORDER BY rp.last_read DESC
    `).all(req.user.id);
    res.json({ progress });
  } catch (e) {
    console.error("Get progress:", e);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

// Update or create progress
router.put("/:bookId", authenticateToken, (req, res) => {
  try {
    const { currentChapter, progressPercent } = req.body;
    const bookId = parseInt(req.params.bookId);
    const userId = req.user.id;

    const existing = db.prepare("SELECT id, streak_days FROM reading_progress WHERE user_id=? AND book_id=?").get(userId, bookId);

    if (existing) {
      db.prepare("UPDATE reading_progress SET current_chapter=?, progress_percent=?, streak_days=streak_days+1, last_read=datetime('now') WHERE id=?")
        .run(currentChapter || 1, progressPercent || 0, existing.id);
    } else {
      db.prepare("INSERT INTO reading_progress (user_id, book_id, current_chapter, progress_percent, streak_days) VALUES (?,?,?,?,1)")
        .run(userId, bookId, currentChapter || 1, progressPercent || 0);
    }

    const updated = db.prepare(`
      SELECT rp.*, b.title, b.author, b.cover_url,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM reading_progress rp JOIN books b ON b.id=rp.book_id
      WHERE rp.user_id=? AND rp.book_id=?
    `).get(userId, bookId);

    res.json({ message: "Progress updated", progress: updated });
  } catch (e) {
    console.error("Update progress:", e);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

// Delete progress (remove book from reading list)
router.delete("/:bookId", authenticateToken, (req, res) => {
  try {
    db.prepare("DELETE FROM reading_progress WHERE user_id=? AND book_id=?").run(req.user.id, parseInt(req.params.bookId));
    res.json({ message: "Removed from reading list" });
  } catch (e) {
    console.error("Delete progress:", e);
    res.status(500).json({ error: "Failed to remove" });
  }
});

export default router;
