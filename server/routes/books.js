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

// Get all books (user's own uploads + admin-uploaded books for everyone)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const books = (await pool.query(`
      SELECT b.id, b.title, b.author, b.genre, b.cover_url, b.description, 
             b.pages, b.published_year, b.rating,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM books b
      WHERE b.uploaded_by = $1
         OR b.uploaded_by IN (SELECT id FROM users WHERE role = 'admin')
      ORDER BY b.title
    `, [req.user.id])).rows;
    res.json({ books });
  } catch (e) {
    console.error("Get books:", e);
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// Get single book (must belong to user or be admin-uploaded)
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const book = (await pool.query(
      "SELECT * FROM books WHERE id=$1 AND (uploaded_by=$2 OR uploaded_by IN (SELECT id FROM users WHERE role='admin'))",
      [req.params.id, req.user.id]
    )).rows[0];
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

// Search books (local — user's own + admin-uploaded)
router.get("/search/:query", authenticateToken, async (req, res) => {
  try {
    const q = `%${req.params.query}%`;
    const books = (await pool.query(`
      SELECT b.id, b.title, b.author, b.genre, b.cover_url, b.description,
             b.pages, b.published_year, b.rating,
             (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters
      FROM books b
      WHERE (b.uploaded_by = $1 OR b.uploaded_by IN (SELECT id FROM users WHERE role = 'admin'))
        AND (b.title ILIKE $2 OR b.author ILIKE $3 OR b.genre ILIKE $4)
      ORDER BY b.title
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

// ---- Smart chapter splitting ----
function splitIntoChapters(text) {
  // 1) Try explicit chapter/part markers: "Chapter 1", "CHAPTER ONE", "Part 2", etc.
  const chapterRegex = /\n\s*(?=(?:chapter|parte?)\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[^\n]*)/i;
  let splits = text.split(chapterRegex).filter(s => s.trim());
  if (splits.length > 1) {
    return splits.map((chunk, i) => {
      const titleMatch = chunk.match(/^((?:chapter|parte?)\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[^\n]*)/i);
      return {
        title: titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : `Chapter ${i + 1}`,
        content: chunk.trim(),
      };
    });
  }

  // 2) Try numbered section markers: "1.", "1)", "Section 1", "UNIT 1", "Lesson 1", "Module 1"
  const sectionRegex = /\n\s*(?=(?:section|unit|lesson|module|topic)\s+\d+[^\n]*)/i;
  splits = text.split(sectionRegex).filter(s => s.trim());
  if (splits.length > 1) {
    return splits.map((chunk, i) => {
      const titleMatch = chunk.match(/^((?:section|unit|lesson|module|topic)\s+\d+[^\n]*)/i);
      return {
        title: titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : `Section ${i + 1}`,
        content: chunk.trim(),
      };
    });
  }

  // 3) Try all-caps or bold-looking headings on their own line (e.g. "INTRODUCTION", "THE BEGINNING")
  const headingRegex = /\n\s*(?=(?:[A-Z][A-Z\s]{4,})\s*\n)/;
  splits = text.split(headingRegex).filter(s => s.trim());
  if (splits.length >= 3 && splits.length <= 80) {
    return splits.map((chunk, i) => {
      const titleMatch = chunk.match(/^([A-Z][A-Z\s]{4,})/);
      return {
        title: titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : `Section ${i + 1}`,
        content: chunk.trim(),
      };
    });
  }

  // 4) Try splitting by large paragraph gaps (3+ blank lines) for natural sections
  splits = text.split(/\n\s*\n\s*\n\s*\n/).filter(s => s.trim());
  if (splits.length >= 2 && splits.length <= 60) {
    return splits.map((chunk, i) => {
      // Use the first line as a title if it's short enough, otherwise generic
      const firstLine = chunk.trim().split("\n")[0].trim();
      const title = firstLine.length > 3 && firstLine.length < 80 ? firstLine : `Section ${i + 1}`;
      return { title, content: chunk.trim() };
    });
  }

  // 5) Split by double newlines into paragraphs, then group into ~5000 word chapters
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  if (paragraphs.length <= 1) {
    return [{ title: "Full Text", content: text.trim() }];
  }

  const TARGET_WORDS = 5000;
  const chapters = [];
  let currentContent = "";
  let currentWords = 0;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length;
    if (currentWords > 0 && currentWords + paraWords > TARGET_WORDS) {
      const firstLine = currentContent.trim().split("\n")[0].trim();
      const title = firstLine.length > 3 && firstLine.length < 80 ? firstLine : `Chapter ${chapters.length + 1}`;
      chapters.push({ title, content: currentContent.trim() });
      currentContent = para;
      currentWords = paraWords;
    } else {
      currentContent += (currentContent ? "\n\n" : "") + para;
      currentWords += paraWords;
    }
  }
  if (currentContent.trim()) {
    const firstLine = currentContent.trim().split("\n")[0].trim();
    const title = firstLine.length > 3 && firstLine.length < 80 ? firstLine : `Chapter ${chapters.length + 1}`;
    chapters.push({ title, content: currentContent.trim() });
  }

  return chapters.length > 0 ? chapters : [{ title: "Full Text", content: text.trim() }];
}

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

    // Split content into chapters intelligently
    let chapters = splitIntoChapters(content);

    // Estimate page count (~250 words per page)
    const wordCount = content.split(/\s+/).length;
    const estimatedPages = Math.max(1, Math.round(wordCount / 250));

    const coverUrl = `https://ui-avatars.com/api/?background=f97316&color=fff&bold=true&size=200&name=${encodeURIComponent(title)}`;
    const result = await pool.query(
      "INSERT INTO books (title, author, genre, cover_url, description, pages, published_year, rating, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
      [title, author || "Unknown", genre || "Personal", coverUrl, `${chapters.length} chapter(s), ~${estimatedPages} pages`, estimatedPages, new Date().getFullYear(), 0, req.user.id]
    );

    const bookId = result.rows[0].id;

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
