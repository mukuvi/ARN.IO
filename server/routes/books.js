import express from "express";
import pool from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Get all books
router.get("/", authenticateToken, async (req, res) => {
  try {
    const books = (await pool.query(`
      SELECT b.id, b.title, b.author, b.genre, b.cover_url, b.description, 
             b.pages, b.published_year, b.rating,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM books b ORDER BY b.title
    `)).rows;
    res.json({ books });
  } catch (e) {
    console.error("Get books:", e);
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// Get single book
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const book = (await pool.query("SELECT * FROM books WHERE id=$1", [req.params.id])).rows[0];
    if (!book) return res.status(404).json({ error: "Book not found" });
    const chapters = (await pool.query("SELECT chapter_number,title FROM chapters WHERE book_id=$1 ORDER BY chapter_number", [book.id])).rows;
    res.json({ book, chapters });
  } catch (e) {
    console.error("Get book:", e);
    res.status(500).json({ error: "Failed to fetch book" });
  }
});

// Get chapter content
router.get("/:id/chapters/:num", authenticateToken, async (req, res) => {
  try {
    const chapter = (await pool.query("SELECT * FROM chapters WHERE book_id=$1 AND chapter_number=$2", [req.params.id, req.params.num])).rows[0];
    if (!chapter) return res.status(404).json({ error: "Chapter not found" });
    res.json({ chapter });
  } catch (e) {
    console.error("Get chapter:", e);
    res.status(500).json({ error: "Failed to fetch chapter" });
  }
});

// Search books
router.get("/search/:query", authenticateToken, async (req, res) => {
  try {
    const q = `%${req.params.query}%`;
    const books = (await pool.query(`
      SELECT b.id, b.title, b.author, b.genre, b.cover_url, b.description,
             b.pages, b.published_year, b.rating,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM books b WHERE b.title ILIKE $1 OR b.author ILIKE $2 OR b.genre ILIKE $3 ORDER BY b.title
    `, [q, q, q])).rows;
    res.json({ books });
  } catch (e) {
    console.error("Search:", e);
    res.status(500).json({ error: "Search failed" });
  }
});

// User uploads their own document
router.post("/upload", authenticateToken, async (req, res) => {
  try {
    const { title, author, genre, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Title and content are required" });

    const coverUrl = `https://ui-avatars.com/api/?background=f97316&color=fff&bold=true&size=200&name=${encodeURIComponent(title)}`;
    const result = await pool.query(
      "INSERT INTO books (title, author, genre, cover_url, description, pages, published_year, rating, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
      [title, author || "Unknown", genre || "Personal", coverUrl, "Uploaded by user", 0, new Date().getFullYear(), 0, req.user.id]
    );

    const bookId = result.rows[0].id;

    // Split content into chapters
    const chapterSplits = content.split(/\n\s*(?=chapter\s+\d|part\s+\d)/i);
    let chapters;
    if (chapterSplits.length > 1) {
      chapters = chapterSplits.map((text, i) => {
        const titleMatch = text.match(/^(chapter\s+\d+[^\n]*|part\s+\d+[^\n]*)/i);
        return { title: titleMatch ? titleMatch[1].trim() : `Chapter ${i + 1}`, content: text.trim() };
      });
    } else {
      const chunkSize = 2000;
      chapters = [];
      for (let i = 0; i < content.length; i += chunkSize) {
        chapters.push({ title: `Section ${chapters.length + 1}`, content: content.slice(i, i + chunkSize).trim() });
      }
      if (chapters.length === 0) chapters = [{ title: "Full Text", content: content.trim() }];
    }

    for (let i = 0; i < chapters.length; i++) {
      await pool.query(
        "INSERT INTO chapters (book_id, chapter_number, title, content) VALUES ($1,$2,$3,$4)",
        [bookId, i + 1, chapters[i].title, chapters[i].content]
      );
    }

    // Auto-add to reading progress
    await pool.query(
      "INSERT INTO reading_progress (user_id, book_id, current_chapter, progress_percent, streak_days) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      [req.user.id, bookId, 1, 0, 0]
    );

    res.status(201).json({ message: "Document uploaded", bookId, chaptersCreated: chapters.length });
  } catch (e) {
    console.error("Upload document:", e);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
