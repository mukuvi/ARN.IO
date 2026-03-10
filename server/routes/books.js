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
  // Clean up excessive whitespace but preserve paragraph structure
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // --- Step 1: Remove Table of Contents ---
  // TOC is typically a list of short lines with page numbers or chapter names without body text.
  // Detect and strip it so it doesn't create fake chapters.
  text = removeTOC(text);

  // --- Step 2: Try explicit "Chapter N" / "Part N" markers ---
  const chapterPattern = /^[ \t]*(?:chapter|part)\s+(?:\d{1,3}|[ivxlcdm]{1,10}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)[^\n]*/im;
  let chapters = splitByPattern(text, chapterPattern, 200);
  if (chapters) return chapters;

  // --- Step 3: Try "Section/Unit/Lesson/Module N" markers ---
  const sectionPattern = /^[ \t]*(?:section|unit|lesson|module|topic)\s+\d+[^\n]*/im;
  chapters = splitByPattern(text, sectionPattern, 200);
  if (chapters) return chapters;

  // --- Step 4: Try standalone numbered headings like "1. Title" or "1 - Title" at line start ---
  const numberedPattern = /^[ \t]*\d{1,3}[\.\)\-:]\s+[A-Z][^\n]*/m;
  chapters = splitByPattern(text, numberedPattern, 200);
  if (chapters) return chapters;

  // --- Step 5: Try ALL-CAPS headings (at least 5 chars, on their own line with body text after) ---
  const capsPattern = /^[ \t]*[A-Z][A-Z\s]{4,}$/m;
  chapters = splitByPattern(text, capsPattern, 300);
  if (chapters) return chapters;

  // --- Step 6: Group paragraphs into natural-length chapters ---
  return groupParagraphs(text);
}

// Remove Table of Contents / Index / Contents sections
function removeTOC(text) {
  // Match a TOC header line followed by lines that look like TOC entries
  // TOC entries: short text (chapter names) often followed by dots/spaces and page numbers
  const tocHeaderRegex = /^[ \t]*(?:table\s+of\s+contents?|contents?|index)\s*$/im;
  const match = text.match(tocHeaderRegex);
  if (!match) return text;

  const tocStart = match.index;
  const afterHeader = text.slice(tocStart);
  const lines = afterHeader.split("\n");

  // Walk lines after the TOC header; TOC entries are typically:
  //   - short (< 80 chars)
  //   - may contain dot leaders "....." or page numbers
  //   - may start with "Chapter" / numbers
  // Stop when we hit a long paragraph (>120 chars) or a clear chapter start with body
  let tocEnd = tocStart;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") { tocEnd += lines[i].length + 1; continue; }
    const isTocEntry = (
      line.length < 100 &&
      (/\.{3,}/.test(line) || /\d+\s*$/.test(line) || line.length < 60)
    );
    if (isTocEntry) {
      tocEnd += lines[i].length + 1;
    } else {
      break;
    }
  }

  // Remove the TOC block
  return text.slice(0, tocStart) + "\n" + text.slice(tocEnd);
}

// Split text by a heading pattern, returning chapters only if each has real body content
function splitByPattern(text, pattern, minBodyLength) {
  // Find all heading positions
  const headings = [];
  const globalPattern = new RegExp(pattern.source, pattern.flags.replace("m", "") + "gm");
  let m;
  while ((m = globalPattern.exec(text)) !== null) {
    headings.push({ index: m.index, match: m[0].trim() });
  }

  if (headings.length < 2) return null;

  // Build chapters between headings
  const chapters = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : text.length;
    const chunkText = text.slice(start, end).trim();

    // The title is the heading line; content is everything after it
    const newlineIdx = chunkText.indexOf("\n");
    const title = newlineIdx > 0 ? chunkText.slice(0, newlineIdx).trim() : chunkText.slice(0, 80).trim();
    const body = newlineIdx > 0 ? chunkText.slice(newlineIdx).trim() : "";

    chapters.push({ title: title.replace(/\s+/g, " "), content: chunkText });
  }

  // Handle any content before the first heading (preface, intro, etc.)
  if (headings[0].index > 0) {
    const prefaceText = text.slice(0, headings[0].index).trim();
    if (prefaceText.length > minBodyLength) {
      const firstLine = prefaceText.split("\n")[0].trim();
      const title = firstLine.length > 3 && firstLine.length < 80 ? firstLine : "Introduction";
      chapters.unshift({ title, content: prefaceText });
    }
  }

  // Verify the splits look real: most chunks should have body text, not just one-liners (TOC entries)
  const chunksWithBody = chapters.filter(c => c.content.length > minBodyLength);
  if (chunksWithBody.length < chapters.length * 0.5) return null; // Probably splitting on TOC lines, reject

  // Filter out tiny stub chapters (< 50 chars body)
  return chapters.filter(c => c.content.length > 50);
}

// Fallback: group paragraphs into ~5000 word chapters
function groupParagraphs(text) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  if (paragraphs.length <= 1) {
    return [{ title: "Full Text", content: text.trim() }];
  }

  const TARGET_WORDS = 5000;
  const chapters = [];
  let currentContent = "";
  let currentWords = 0;

  for (const para of paragraphs) {
    const paraWords = para.trim().split(/\s+/).length;
    if (currentWords > 0 && currentWords + paraWords > TARGET_WORDS) {
      chapters.push({ title: `Chapter ${chapters.length + 1}`, content: currentContent.trim() });
      currentContent = para;
      currentWords = paraWords;
    } else {
      currentContent += (currentContent ? "\n\n" : "") + para;
      currentWords += paraWords;
    }
  }
  if (currentContent.trim()) {
    chapters.push({ title: `Chapter ${chapters.length + 1}`, content: currentContent.trim() });
  }

  // If we ended up with just one chapter, that's fine
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
