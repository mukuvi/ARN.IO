import express from "express";
import { createRequire } from "module";
import pool from "../database.js";
import { authenticateToken } from "../middleware/auth.js";
import multer from "multer";
import mammoth from "mammoth";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Get all books (only the user's own uploads)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const books = (await pool.query(`
      SELECT b.id, b.title, b.author, b.genre, b.cover_url, b.description, 
             b.pages, b.published_year, b.rating,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM books b WHERE b.uploaded_by = $1 ORDER BY b.title
    `, [req.user.id])).rows;
    res.json({ books });
  } catch (e) {
    console.error("Get books:", e);
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// Get single book (must belong to user)
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const book = (await pool.query("SELECT * FROM books WHERE id=$1 AND uploaded_by=$2", [req.params.id, req.user.id])).rows[0];
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

// Search books (local — user's own only)
router.get("/search/:query", authenticateToken, async (req, res) => {
  try {
    const q = `%${req.params.query}%`;
    const books = (await pool.query(`
      SELECT b.id, b.title, b.author, b.genre, b.cover_url, b.description,
             b.pages, b.published_year, b.rating,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM books b WHERE b.uploaded_by = $1 AND (b.title ILIKE $2 OR b.author ILIKE $3 OR b.genre ILIKE $4) ORDER BY b.title
    `, [req.user.id, q, q, q])).rows;
    res.json({ books });
  } catch (e) {
    console.error("Search:", e);
    res.status(500).json({ error: "Search failed" });
  }
});

// Search books online via Google Books API
router.get("/search-online/:query", authenticateToken, async (req, res) => {
  try {
    const query = encodeURIComponent(req.params.query);
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=12&printType=books`);
    const data = await response.json();
    
    const onlineBooks = (data.items || []).map(item => {
      const info = item.volumeInfo || {};
      return {
        id: `google_${item.id}`,
        googleId: item.id,
        title: info.title || "Unknown Title",
        author: (info.authors || []).join(", ") || "Unknown Author",
        genre: (info.categories || []).join(", ") || "General",
        cover_url: info.imageLinks?.thumbnail?.replace("http:", "https:") || `https://ui-avatars.com/api/?background=6b7280&color=fff&bold=true&size=200&name=${encodeURIComponent(info.title || "Book")}`,
        description: info.description || "",
        pages: info.pageCount || 0,
        published_year: info.publishedDate ? parseInt(info.publishedDate) : 0,
        rating: info.averageRating || 0,
        previewLink: info.previewLink || null,
        infoLink: info.infoLink || null,
        isOnline: true,
      };
    });

    res.json({ books: onlineBooks });
  } catch (e) {
    console.error("Online search:", e);
    res.status(500).json({ error: "Online search failed" });
  }
});

// User uploads their own document (supports .txt, .md, .html, .pdf, .docx, .doc, .rtf, .odt)
router.post("/upload", authenticateToken, upload.single("file"), async (req, res) => {
  try {
    let { title, author, genre, content } = req.body;
    const file = req.file;

    // Extract text from uploaded file if present
    if (file) {
      const ext = file.originalname.split(".").pop().toLowerCase();
      const mime = file.mimetype || "";

      if (ext === "pdf" || mime === "application/pdf") {
        const result = await pdfParse(file.buffer);
        content = result.text;
      } else if (ext === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        content = result.value;
      } else if (ext === "doc" || mime === "application/msword") {
        // .doc (legacy Word) — mammoth can sometimes handle it, fall back to raw text
        try {
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          content = result.value;
        } catch {
          content = file.buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
        }
      } else if (ext === "rtf" || mime === "application/rtf") {
        // Strip RTF control words for a basic plain-text extraction
        content = file.buffer.toString("utf-8")
          .replace(/\{\\[^{}]*\}/g, "")
          .replace(/\\[a-z]+\d*\s?/gi, "")
          .replace(/[{}]/g, "")
          .trim();
      } else {
        // Plain text formats: .txt, .md, .html, .odt (raw), etc.
        content = file.buffer.toString("utf-8");
      }

      if (!title) title = file.originalname.replace(/\.[^.]+$/, "");
    }

    if (!title || !content) return res.status(400).json({ error: "Title and content are required" });

    // Strip HTML tags if content looks like HTML
    if (/<[^>]+>/.test(content)) {
      content = content.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").trim();
    }

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
