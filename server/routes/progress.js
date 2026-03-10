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

    // Calculate real streak for user
    const streak = await calculateStreak(req.user.id);
    
    res.json({ progress, streak });
  } catch (e) {
    console.error("Get progress:", e);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

// Calculate consecutive reading days (real streak)
async function calculateStreak(userId) {
  const result = await pool.query(
    "SELECT DISTINCT streak_date FROM daily_streaks WHERE user_id = $1 ORDER BY streak_date DESC",
    [userId]
  );
  
  if (result.rows.length === 0) return { current: 0, longest: 0, totalDays: 0 };
  
  const dates = result.rows.map(r => new Date(r.streak_date));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Current streak: count consecutive days backwards from today or yesterday
  let currentStreak = 0;
  const firstDate = new Date(dates[0]);
  firstDate.setHours(0, 0, 0, 0);
  
  if (firstDate.getTime() === today.getTime() || firstDate.getTime() === yesterday.getTime()) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      prev.setHours(0, 0, 0, 0);
      curr.setHours(0, 0, 0, 0);
      const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }
  
  // Longest streak
  let longestStreak = 1;
  let tempStreak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    prev.setHours(0, 0, 0, 0);
    curr.setHours(0, 0, 0, 0);
    const diffDays = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }
  
  return { current: currentStreak, longest: longestStreak, totalDays: dates.length };
}

// Update or create progress — tracks real daily streaks
router.put("/:bookId", authenticateToken, async (req, res) => {
  try {
    const { currentChapter, progressPercent } = req.body;
    const bookId = parseInt(req.params.bookId);
    const userId = req.user.id;

    const existing = (await pool.query("SELECT id, current_chapter, progress_percent FROM reading_progress WHERE user_id=$1 AND book_id=$2", [userId, bookId])).rows[0];

    const totalChapters = (await pool.query("SELECT COUNT(*) as count FROM chapters WHERE book_id=$1", [bookId])).rows[0].count;
    const pct = progressPercent != null ? progressPercent : (totalChapters > 0 ? Math.round((currentChapter / totalChapters) * 100) : 0);
    const isComplete = pct >= 100;

    if (existing) {
      const chaptersAdvanced = (currentChapter || 1) - (existing.current_chapter || 1);
      
      await pool.query(
        `UPDATE reading_progress SET current_chapter=$1, progress_percent=$2, last_read=NOW()${isComplete ? ", completed_at=NOW()" : ""} WHERE id=$3`,
        [currentChapter || 1, Math.min(pct, 100), existing.id]
      );

      // Record reading session
      if (chaptersAdvanced > 0) {
        await pool.query(
          "INSERT INTO reading_sessions (user_id, book_id, pages_read, chapters_read) VALUES ($1,$2,$3,$4)",
          [userId, bookId, 0, chaptersAdvanced]
        );
      }
    } else {
      await pool.query(
        "INSERT INTO reading_progress (user_id, book_id, current_chapter, progress_percent, streak_days, started_at) VALUES ($1,$2,$3,$4,0,NOW())",
        [userId, bookId, currentChapter || 1, Math.min(pct, 100)]
      );
    }

    // Update daily streak tracking
    const today = new Date().toISOString().split("T")[0];
    const chaptersCompleted = currentChapter ? 1 : 0;
    const booksCompleted = isComplete ? 1 : 0;
    
    await pool.query(`
      INSERT INTO daily_streaks (user_id, streak_date, chapters_completed, books_completed)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, streak_date) 
      DO UPDATE SET chapters_completed = daily_streaks.chapters_completed + $3,
                    books_completed = daily_streaks.books_completed + $4
    `, [userId, today, chaptersCompleted, booksCompleted]);

    // Update the streak_days field to reflect real current streak
    const streak = await calculateStreak(userId);
    await pool.query("UPDATE reading_progress SET streak_days=$1 WHERE user_id=$2 AND book_id=$3", [streak.current, userId, bookId]);

    const updated = (await pool.query(`
      SELECT rp.*, b.title, b.author, b.cover_url,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM reading_progress rp JOIN books b ON b.id=rp.book_id
      WHERE rp.user_id=$1 AND rp.book_id=$2
    `, [userId, bookId])).rows[0];

    res.json({ message: "Progress updated", progress: updated, streak });
  } catch (e) {
    console.error("Update progress:", e);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

// Get streak info
router.get("/streak", authenticateToken, async (req, res) => {
  try {
    const streak = await calculateStreak(req.user.id);
    res.json({ streak });
  } catch (e) {
    console.error("Get streak:", e);
    res.status(500).json({ error: "Failed to get streak" });
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
