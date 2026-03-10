import express from "express";
import db from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Get all books
router.get("/", authenticateToken, (req, res) => {
  try {
    const books = db.prepare(`
      SELECT b.id, b.title, b.author, b.genre, b.cover_url, b.description, 
             b.pages, b.published_year, b.rating,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM books b ORDER BY b.title
    `).all();
    res.json({ books });
  } catch (e) {
    console.error("Get books:", e);
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// Get single book
router.get("/:id", authenticateToken, (req, res) => {
  try {
    const book = db.prepare("SELECT * FROM books WHERE id=?").get(req.params.id);
    if (!book) return res.status(404).json({ error: "Book not found" });
    const chapters = db.prepare("SELECT chapter_number,title FROM chapters WHERE book_id=? ORDER BY chapter_number").all(book.id);
    res.json({ book, chapters });
  } catch (e) {
    console.error("Get book:", e);
    res.status(500).json({ error: "Failed to fetch book" });
  }
});

// Get chapter content
router.get("/:id/chapters/:num", authenticateToken, (req, res) => {
  try {
    const chapter = db.prepare("SELECT * FROM chapters WHERE book_id=? AND chapter_number=?").get(req.params.id, req.params.num);
    if (!chapter) return res.status(404).json({ error: "Chapter not found" });
    res.json({ chapter });
  } catch (e) {
    console.error("Get chapter:", e);
    res.status(500).json({ error: "Failed to fetch chapter" });
  }
});

// Search books
router.get("/search/:query", authenticateToken, (req, res) => {
  try {
    const q = `%${req.params.query}%`;
    const books = db.prepare(`
      SELECT b.id, b.title, b.author, b.genre, b.cover_url, b.description,
             b.pages, b.published_year, b.rating,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM books b WHERE b.title LIKE ? OR b.author LIKE ? OR b.genre LIKE ? ORDER BY b.title
    `).all(q, q, q);
    res.json({ books });
  } catch (e) {
    console.error("Search:", e);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
