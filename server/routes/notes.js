import express from "express";
import pool from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Save a note
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { bookId, chapterNumber, content, noteType } = req.body;
    if (!bookId || !content) return res.status(400).json({ error: "Book and content required" });

    const result = await pool.query(
      "INSERT INTO notes (user_id, book_id, chapter_number, content, note_type) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [req.user.id, bookId, chapterNumber || null, content, noteType || "note"]
    );

    res.status(201).json({ note: result.rows[0] });
  } catch (e) {
    console.error("Create note:", e);
    res.status(500).json({ error: "Failed to save note" });
  }
});

// Get notes for a book
router.get("/book/:bookId", authenticateToken, async (req, res) => {
  try {
    const notes = (await pool.query("SELECT * FROM notes WHERE user_id=$1 AND book_id=$2 ORDER BY created_at DESC", [req.user.id, req.params.bookId])).rows;
    res.json({ notes });
  } catch (e) {
    console.error("Get notes:", e);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// Delete note
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM notes WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
    res.json({ message: "Note deleted" });
  } catch (e) {
    console.error("Delete note:", e);
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
