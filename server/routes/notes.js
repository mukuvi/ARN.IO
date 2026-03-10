import express from "express";
import db from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Save a note
router.post("/", authenticateToken, (req, res) => {
  try {
    const { bookId, chapterNumber, content, noteType } = req.body;
    if (!bookId || !content) return res.status(400).json({ error: "Book and content required" });

    const result = db.prepare("INSERT INTO notes (user_id, book_id, chapter_number, content, note_type) VALUES (?,?,?,?,?)")
      .run(req.user.id, bookId, chapterNumber || null, content, noteType || "note");

    const note = db.prepare("SELECT * FROM notes WHERE id=?").get(result.lastInsertRowid);
    res.status(201).json({ note });
  } catch (e) {
    console.error("Create note:", e);
    res.status(500).json({ error: "Failed to save note" });
  }
});

// Get notes for a book
router.get("/book/:bookId", authenticateToken, (req, res) => {
  try {
    const notes = db.prepare("SELECT * FROM notes WHERE user_id=? AND book_id=? ORDER BY created_at DESC").all(req.user.id, req.params.bookId);
    res.json({ notes });
  } catch (e) {
    console.error("Get notes:", e);
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// Delete note
router.delete("/:id", authenticateToken, (req, res) => {
  try {
    db.prepare("DELETE FROM notes WHERE id=? AND user_id=?").run(req.params.id, req.user.id);
    res.json({ message: "Note deleted" });
  } catch (e) {
    console.error("Delete note:", e);
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
