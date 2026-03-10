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

// User uploads their own document
router.post("/upload", authenticateToken, (req, res) => {
  try {
    const { title, author, genre, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Title and content are required" });

    const coverUrl = `https://ui-avatars.com/api/?background=f97316&color=fff&bold=true&size=200&name=${encodeURIComponent(title)}`;
    const result = db.prepare(
      "INSERT INTO books (title, author, genre, cover_url, description, pages, published_year, rating, uploaded_by) VALUES (?,?,?,?,?,?,?,?,?)"
    ).run(title, author || "Unknown", genre || "Personal", coverUrl, `Uploaded by user`, 0, new Date().getFullYear(), 0, req.user.id);

    const bookId = result.lastInsertRowid;

    // Split content into chapters (by double newline or "Chapter" headings, or just chunk it)
    const chapterSplits = content.split(/\n\s*(?=chapter\s+\d|part\s+\d)/i);
    let chapters;
    if (chapterSplits.length > 1) {
      chapters = chapterSplits.map((text, i) => {
        const titleMatch = text.match(/^(chapter\s+\d+[^\n]*|part\s+\d+[^\n]*)/i);
        return { title: titleMatch ? titleMatch[1].trim() : `Chapter ${i + 1}`, content: text.trim() };
      });
    } else {
      // Split into ~2000 char chunks as chapters
      const chunkSize = 2000;
      chapters = [];
      for (let i = 0; i < content.length; i += chunkSize) {
        chapters.push({ title: `Section ${chapters.length + 1}`, content: content.slice(i, i + chunkSize).trim() });
      }
      if (chapters.length === 0) chapters = [{ title: "Full Text", content: content.trim() }];
    }

    const ins = db.prepare("INSERT INTO chapters (book_id, chapter_number, title, content) VALUES (?,?,?,?)");
    chapters.forEach((ch, i) => ins.run(bookId, i + 1, ch.title, ch.content));

    // Auto-add to user's reading progress
    db.prepare("INSERT OR IGNORE INTO reading_progress (user_id, book_id, current_chapter, progress_percent, streak_days) VALUES (?,?,?,?,?)")
      .run(req.user.id, bookId, 1, 0, 0);

    res.status(201).json({ message: "Document uploaded", bookId, chaptersCreated: chapters.length });
  } catch (e) {
    console.error("Upload document:", e);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
