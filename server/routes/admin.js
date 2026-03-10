import express from "express";
import bcrypt from "bcryptjs";
import pool from "../database.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get("/stats", async (req, res) => {
  try {
    const totalUsers = (await pool.query("SELECT COUNT(*) as count FROM users")).rows[0].count;
    const totalBooks = (await pool.query("SELECT COUNT(*) as count FROM books")).rows[0].count;
    const totalChapters = (await pool.query("SELECT COUNT(*) as count FROM chapters")).rows[0].count;
    const totalNotes = (await pool.query("SELECT COUNT(*) as count FROM notes")).rows[0].count;
    const totalChats = (await pool.query("SELECT COUNT(*) as count FROM ai_chats")).rows[0].count;
    const totalAdmins = (await pool.query("SELECT COUNT(*) as count FROM users WHERE role='admin'")).rows[0].count;
    const activeReaders = (await pool.query("SELECT COUNT(DISTINCT user_id) as count FROM reading_progress")).rows[0].count;
    const blacklistedUsers = (await pool.query("SELECT COUNT(*) as count FROM users WHERE blacklisted = true")).rows[0].count;

    const recentUsers = (await pool.query("SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT 5")).rows;
    const popularBooks = (await pool.query(`
      SELECT b.title, b.author, COUNT(rp.id) as readers 
      FROM books b LEFT JOIN reading_progress rp ON rp.book_id = b.id 
      GROUP BY b.id, b.title, b.author ORDER BY readers DESC LIMIT 5
    `)).rows;

    res.json({ stats: { totalUsers: parseInt(totalUsers), totalBooks: parseInt(totalBooks), totalChapters: parseInt(totalChapters), totalNotes: parseInt(totalNotes), totalChats: parseInt(totalChats), totalAdmins: parseInt(totalAdmins), activeReaders: parseInt(activeReaders), blacklistedUsers: parseInt(blacklistedUsers), recentUsers, popularBooks } });
  } catch (e) {
    console.error("Admin stats:", e);
    res.status(500).json({ error: "Failed to get admin stats" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = (await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.profile_pic, u.bio, u.created_at, u.last_login,
        COALESCE(u.blacklisted, false) as blacklisted, u.blacklisted_at, COALESCE(u.blacklist_reason, '') as blacklist_reason,
        (SELECT COUNT(*) FROM reading_progress rp WHERE rp.user_id = u.id) as books_reading,
        (SELECT COUNT(*) FROM notes n WHERE n.user_id = u.id) as total_notes
      FROM users u ORDER BY u.created_at DESC
    `)).rows;
    res.json({ users });
  } catch (e) {
    console.error("Admin users:", e);
    res.status(500).json({ error: "Failed to get users" });
  }
});

router.put("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "user"].includes(role)) return res.status(400).json({ error: "Invalid role" });

    const targetUser = (await pool.query("SELECT * FROM users WHERE id=$1", [req.params.id])).rows[0];
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    if (parseInt(req.params.id) === req.user.id && role !== "admin") {
      return res.status(400).json({ error: "Cannot remove your own admin role" });
    }

    await pool.query("UPDATE users SET role=$1 WHERE id=$2", [role, req.params.id]);
    res.json({ message: `User role updated to ${role}` });
  } catch (e) {
    console.error("Update role:", e);
    res.status(500).json({ error: "Failed to update role" });
  }
});

router.put("/users/:id/blacklist", async (req, res) => {
  try {
    const { blacklisted, reason } = req.body;
    if (typeof blacklisted !== "boolean") return res.status(400).json({ error: "blacklisted must be true or false" });

    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: "Cannot blacklist your own account" });
    }

    const targetUser = (await pool.query("SELECT * FROM users WHERE id=$1", [req.params.id])).rows[0];
    if (!targetUser) return res.status(404).json({ error: "User not found" });
    if (targetUser.role === "admin") return res.status(400).json({ error: "Cannot blacklist an admin. Remove admin role first." });

    await pool.query(
      "UPDATE users SET blacklisted=$1, blacklisted_at=$2, blacklist_reason=$3 WHERE id=$4",
      [blacklisted, blacklisted ? new Date() : null, blacklisted ? (reason || "Suspended by admin") : "", req.params.id]
    );

    res.json({ message: blacklisted ? "User blacklisted" : "User unblacklisted" });
  } catch (e) {
    console.error("Blacklist user:", e);
    res.status(500).json({ error: "Failed to update blacklist status" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account from admin panel" });
    }

    const targetUser = (await pool.query("SELECT * FROM users WHERE id=$1", [req.params.id])).rows[0];
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    await pool.query("DELETE FROM ai_chats WHERE user_id=$1", [req.params.id]);
    await pool.query("DELETE FROM notes WHERE user_id=$1", [req.params.id]);
    await pool.query("DELETE FROM daily_streaks WHERE user_id=$1", [req.params.id]);
    await pool.query("DELETE FROM reading_sessions WHERE user_id=$1", [req.params.id]);
    await pool.query("DELETE FROM reading_progress WHERE user_id=$1", [req.params.id]);
    await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);

    res.json({ message: "User deleted" });
  } catch (e) {
    console.error("Delete user:", e);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.get("/books", async (req, res) => {
  try {
    const books = (await pool.query(`
      SELECT b.*, 
        (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters,
        (SELECT COUNT(*) FROM reading_progress rp WHERE rp.book_id = b.id) as total_readers
      FROM books b ORDER BY b.created_at DESC
    `)).rows;
    res.json({ books });
  } catch (e) {
    console.error("Admin books:", e);
    res.status(500).json({ error: "Failed to get books" });
  }
});

router.post("/books", async (req, res) => {
  try {
    const { title, author, description, coverUrl, genre, pages, publishedYear, rating, chapters } = req.body;
    if (!title || !author) return res.status(400).json({ error: "Title and author required" });

    const result = await pool.query(
      "INSERT INTO books (title,author,description,cover_url,genre,pages,published_year,rating,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
      [title, author, description || "", coverUrl || "", genre || "", pages || 0, publishedYear || 2024, rating || 0, req.user.id]
    );
    const bookId = result.rows[0].id;

    if (chapters && Array.isArray(chapters)) {
      for (let i = 0; i < chapters.length; i++) {
        await pool.query(
          "INSERT INTO chapters (book_id,chapter_number,title,content) VALUES ($1,$2,$3,$4)",
          [bookId, i + 1, chapters[i].title || `Chapter ${i + 1}`, chapters[i].content || ""]
        );
      }
    }

    const book = (await pool.query("SELECT * FROM books WHERE id=$1", [bookId])).rows[0];
    res.status(201).json({ message: "Book created", book });
  } catch (e) {
    console.error("Create book:", e);
    res.status(500).json({ error: "Failed to create book" });
  }
});

router.put("/books/:id", async (req, res) => {
  try {
    const { title, author, description, coverUrl, genre, pages, publishedYear, rating } = req.body;
    const book = (await pool.query("SELECT * FROM books WHERE id=$1", [req.params.id])).rows[0];
    if (!book) return res.status(404).json({ error: "Book not found" });

    const updated = await pool.query(
      "UPDATE books SET title=$1,author=$2,description=$3,cover_url=$4,genre=$5,pages=$6,published_year=$7,rating=$8 WHERE id=$9 RETURNING *",
      [title || book.title, author || book.author, description !== undefined ? description : book.description, coverUrl || book.cover_url, genre || book.genre, pages || book.pages, publishedYear || book.published_year, rating || book.rating, req.params.id]
    );

    res.json({ message: "Book updated", book: updated.rows[0] });
  } catch (e) {
    console.error("Update book:", e);
    res.status(500).json({ error: "Failed to update book" });
  }
});

router.delete("/books/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM ai_chats WHERE book_id=$1", [req.params.id]);
    await pool.query("DELETE FROM notes WHERE book_id=$1", [req.params.id]);
    await pool.query("DELETE FROM reading_sessions WHERE book_id=$1", [req.params.id]);
    await pool.query("DELETE FROM reading_progress WHERE book_id=$1", [req.params.id]);
    await pool.query("DELETE FROM chapters WHERE book_id=$1", [req.params.id]);
    await pool.query("DELETE FROM books WHERE id=$1", [req.params.id]);
    res.json({ message: "Book deleted" });
  } catch (e) {
    console.error("Delete book:", e);
    res.status(500).json({ error: "Failed to delete book" });
  }
});

router.post("/books/:id/chapters", async (req, res) => {
  try {
    const { title, content, chapterNumber } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Title and content required" });

    const book = (await pool.query("SELECT * FROM books WHERE id=$1", [req.params.id])).rows[0];
    if (!book) return res.status(404).json({ error: "Book not found" });

    const maxChapter = (await pool.query("SELECT COALESCE(MAX(chapter_number),0) as max FROM chapters WHERE book_id=$1", [req.params.id])).rows[0];
    const num = chapterNumber || (parseInt(maxChapter.max) + 1);

    const result = await pool.query(
      "INSERT INTO chapters (book_id,chapter_number,title,content) VALUES ($1,$2,$3,$4) RETURNING *",
      [req.params.id, num, title, content]
    );
    res.status(201).json({ message: "Chapter added", chapter: result.rows[0] });
  } catch (e) {
    console.error("Add chapter:", e);
    res.status(500).json({ error: "Failed to add chapter" });
  }
});

export default router;
