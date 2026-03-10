import express from "express";
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../database.js";
import { authenticateToken } from "../middleware/auth.js";
import multer from "multer";
import mammoth from "mammoth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Get all books (user's own uploads + admin-uploaded books for everyone)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const books = (await pool.query(`
      SELECT b.id, b.title, b.author, b.genre, b.cover_url, b.description, 
             b.pages, b.published_year, b.rating, b.uploaded_by,
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

// Get full book text (for "Read Full Book" mode)
router.get("/:id/full-text", authenticateToken, async (req, res) => {
  try {
    const book = (await pool.query(
      "SELECT id, title, full_text FROM books WHERE id=$1 AND (uploaded_by=$2 OR uploaded_by IN (SELECT id FROM users WHERE role='admin'))",
      [req.params.id, req.user.id]
    )).rows[0];
    if (!book) return res.status(404).json({ error: "Book not found" });
    if (!book.full_text) return res.status(404).json({ error: "Full text not available for this book" });
    res.json({ fullText: book.full_text });
  } catch (e) {
    console.error("Get full text:", e);
    res.status(500).json({ error: "Failed to fetch full text" });
  }
});

// Serve original uploaded file (PDF, DOCX, etc.) for in-browser viewing
router.get("/:id/file", authenticateToken, async (req, res) => {
  try {
    const book = (await pool.query(
      "SELECT id, file_path FROM books WHERE id=$1 AND (uploaded_by=$2 OR uploaded_by IN (SELECT id FROM users WHERE role='admin'))",
      [req.params.id, req.user.id]
    )).rows[0];
    if (!book || !book.file_path) return res.status(404).json({ error: "Original file not available" });

    const filePath = path.join(UPLOADS_DIR, book.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found on disk" });

    const ext = path.extname(book.file_path).toLowerCase();
    const mimeMap = {
      ".pdf": "application/pdf",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
      ".txt": "text/plain",
      ".html": "text/html",
      ".md": "text/markdown",
      ".rtf": "application/rtf",
    };
    const contentType = mimeMap[ext] || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    console.error("Serve file:", e);
    res.status(500).json({ error: "Failed to serve file" });
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
        cover_url: info.imageLinks?.thumbnail?.replace("http:", "https:") || `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(info.title || "Book")}&backgroundColor=f97316,ef4444,8b5cf6,3b82f6,10b981,f59e0b&size=200`,
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

// ---- Book Cover Finder ----
async function findBookCover(title, author) {
  // Try Open Library search for a real cover
  try {
    const q = encodeURIComponent(`${title} ${author || ""}`.trim());
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=1&fields=cover_i`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    const coverId = data?.docs?.[0]?.cover_i;
    if (coverId) {
      return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
    }
  } catch {}

  // Fallback: nice gradient cover with book icon via DiceBear
  const seed = encodeURIComponent(title);
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}&backgroundColor=f97316,ef4444,8b5cf6,3b82f6,10b981,f59e0b&size=200`;
}

// ---- AI Author Detection ----
async function detectAuthor(text, title) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  // Use start of text where author info is most likely
  const excerpt = text.slice(0, 5000);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You detect book authors. Respond with ONLY the author's name — nothing else. If you cannot determine the author, respond with exactly: Unknown" },
          { role: "user", content: `Who is the author of this book?\n\nTitle: "${title}"\n\n--- BOOK TEXT (first pages) ---\n${excerpt}` }
        ],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    const data = await response.json();
    const name = data?.choices?.[0]?.message?.content?.trim();
    if (name && name.toLowerCase() !== "unknown" && name.length < 100) {
      console.log(`AI detected author: "${name}" for "${title}"`);
      return name;
    }
    return null;
  } catch (e) {
    console.error("Author detection failed:", e.message);
    return null;
  }
}

// ---- AI Chapter Summarization ----
async function summarizeIntoChapters(text, title, author) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Fallback: simple grouping if no API key
    console.warn("No GROQ_API_KEY — using basic chapter grouping");
    return basicChapterGrouping(text);
  }

  // Truncate text for the AI context window (Groq supports ~128k tokens for llama-3.3-70b)
  // Send up to ~30k chars for summarization to stay well within limits
  const truncatedText = text.slice(0, 30000);
  const wordCount = text.split(/\s+/).length;
  const chapterCount = Math.max(3, Math.min(15, Math.ceil(wordCount / 3000)));

  const prompt = `You are a book analysis assistant. Analyze the following book text and create ${chapterCount} chapter summaries.

Book: "${title}" by ${author || "Unknown"}
Total words: ~${wordCount}

INSTRUCTIONS:
- SKIP any table of contents, index, bibliography, acknowledgments, copyright notices, or front/back matter — do NOT summarize those
- Focus ONLY on the actual substantive content: the core ideas, arguments, narrative sections, and meaningful information
- Divide that real content into ${chapterCount} logical chapters based on topic flow, themes, or narrative structure
- For each chapter, provide a clear title and a detailed summary (200-400 words)
- Summaries should capture the important information: key insights, arguments, data, characters, events, concepts, and takeaways
- Make summaries comprehensive enough that a reader gets the essential knowledge from each section

RESPOND IN EXACTLY THIS JSON FORMAT (no extra text):
[
  {"title": "Chapter Title Here", "summary": "Detailed summary of this chapter's content..."},
  {"title": "Another Chapter Title", "summary": "Detailed summary..."}
]

--- BOOK TEXT ---
${truncatedText}
${text.length > 30000 ? "\n[... text continues beyond this excerpt ...]" : ""}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a precise book analysis assistant. Always respond with valid JSON arrays only. No markdown, no backticks, no extra text." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error("AI summarization error:", data.error.message);
      return basicChapterGrouping(text);
    }

    let aiText = data?.choices?.[0]?.message?.content?.trim();
    if (!aiText) return basicChapterGrouping(text);

    // Strip markdown code fences if the AI wrapped it
    aiText = aiText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    const chapters = JSON.parse(aiText);
    if (!Array.isArray(chapters) || chapters.length === 0) return basicChapterGrouping(text);

    return chapters.map((ch, i) => ({
      title: ch.title || `Chapter ${i + 1}`,
      content: ch.summary || ch.content || "Summary not available."
    }));
  } catch (e) {
    console.error("AI summarization failed:", e.message);
    return basicChapterGrouping(text);
  }
}

// Basic fallback: group text into chapters by word count
function basicChapterGrouping(text) {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  if (paragraphs.length <= 1) return [{ title: "Full Text", content: text.trim() }];

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

    // If no author provided, use AI to detect the author from the book text
    if (!author || author.trim() === "" || author.trim().toLowerCase() === "unknown") {
      const detectedAuthor = await detectAuthor(content, title);
      if (detectedAuthor) author = detectedAuthor;
    }

    // Strip HTML tags if content looks like HTML
    if (/<[^>]+>/.test(content)) {
      content = content.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").trim();
    }

    // Clean up whitespace
    content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Estimate page count (~250 words per page)
    const wordCount = content.split(/\s+/).length;
    const estimatedPages = Math.max(1, Math.round(wordCount / 250));

    const coverUrl = await findBookCover(title, author);

    // Store the book with full text
    const result = await pool.query(
      "INSERT INTO books (title, author, genre, cover_url, description, pages, published_year, rating, uploaded_by, full_text) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id",
      [title, author || "Unknown", genre || "Personal", coverUrl, `~${estimatedPages} pages, ~${wordCount} words`, estimatedPages, new Date().getFullYear(), 0, req.user.id, content]
    );

    const bookId = result.rows[0].id;

    // Save original file to disk for in-browser viewing
    if (file) {
      const ext = file.originalname.split(".").pop().toLowerCase();
      const fileName = `${bookId}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, fileName), file.buffer);
      await pool.query("UPDATE books SET file_path=$1 WHERE id=$2", [fileName, bookId]);
    }

    // Use AI to summarize into chapters
    const chapters = await summarizeIntoChapters(content, title, author);

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

// User deletes their own uploaded book
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const book = (await pool.query(
      "SELECT id, file_path, uploaded_by FROM books WHERE id=$1", [req.params.id]
    )).rows[0];
    if (!book) return res.status(404).json({ error: "Book not found" });
    if (book.uploaded_by !== req.user.id) return res.status(403).json({ error: "You can only delete your own books" });

    // Delete file from disk
    if (book.file_path) {
      const filePath = path.join(UPLOADS_DIR, book.file_path);
      try { fs.unlinkSync(filePath); } catch {}
    }

    // Delete related data
    await pool.query("DELETE FROM ai_chats WHERE book_id=$1", [req.params.id]);
    await pool.query("DELETE FROM notes WHERE book_id=$1", [req.params.id]);
    await pool.query("DELETE FROM reading_sessions WHERE book_id=$1", [req.params.id]);
    await pool.query("DELETE FROM reading_progress WHERE book_id=$1", [req.params.id]);
    await pool.query("DELETE FROM chapters WHERE book_id=$1", [req.params.id]);
    await pool.query("DELETE FROM daily_streaks WHERE user_id=$1", [req.user.id]);
    await pool.query("DELETE FROM books WHERE id=$1", [req.params.id]);

    res.json({ message: "Book deleted" });
  } catch (e) {
    console.error("Delete book:", e);
    res.status(500).json({ error: "Failed to delete book" });
  }
});

export default router;
