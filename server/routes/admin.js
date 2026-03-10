import express from "express";
import bcrypt from "bcryptjs";
import db from "../database.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get("/stats", (req, res) => {
  try {
    const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    const totalBooks = db.prepare("SELECT COUNT(*) as count FROM books").get().count;
    const totalChapters = db.prepare("SELECT COUNT(*) as count FROM chapters").get().count;
    const totalNotes = db.prepare("SELECT COUNT(*) as count FROM notes").get().count;
    const totalChats = db.prepare("SELECT COUNT(*) as count FROM ai_chats").get().count;
    const totalAdmins = db.prepare("SELECT COUNT(*) as count FROM users WHERE role='admin'").get().count;
    const activeReaders = db.prepare("SELECT COUNT(DISTINCT user_id) as count FROM reading_progress").get().count;

    const recentUsers = db.prepare("SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC LIMIT 5").all();
    const popularBooks = db.prepare(`
      SELECT b.title, b.author, COUNT(rp.id) as readers 
      FROM books b LEFT JOIN reading_progress rp ON rp.book_id = b.id 
      GROUP BY b.id ORDER BY readers DESC LIMIT 5
    `).all();

    res.json({ stats: { totalUsers, totalBooks, totalChapters, totalNotes, totalChats, totalAdmins, activeReaders, recentUsers, popularBooks } });
  } catch (e) {
    console.error("Admin stats:", e);
    res.status(500).json({ error: "Failed to get admin stats" });
  }
});

router.get("/users", (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.role, u.profile_pic, u.bio, u.created_at, u.last_login,
        (SELECT COUNT(*) FROM reading_progress rp WHERE rp.user_id = u.id) as books_reading,
        (SELECT COUNT(*) FROM notes n WHERE n.user_id = u.id) as total_notes
      FROM users u ORDER BY u.created_at DESC
    `).all();
    res.json({ users });
  } catch (e) {
    console.error("Admin users:", e);
    res.status(500).json({ error: "Failed to get users" });
  }
});

router.put("/users/:id/role", (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "user"].includes(role)) return res.status(400).json({ error: "Invalid role" });

    const targetUser = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    if (parseInt(req.params.id) === req.user.id && role !== "admin") {
      return res.status(400).json({ error: "Cannot remove your own admin role" });
    }

    db.prepare("UPDATE users SET role=? WHERE id=?").run(role, req.params.id);
    res.json({ message: `User role updated to ${role}` });
  } catch (e) {
    console.error("Update role:", e);
    res.status(500).json({ error: "Failed to update role" });
  }
});

router.delete("/users/:id", (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: "Cannot delete your own account from admin panel" });
    }

    const targetUser = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
    if (!targetUser) return res.status(404).json({ error: "User not found" });

    db.prepare("DELETE FROM ai_chats WHERE user_id=?").run(req.params.id);
    db.prepare("DELETE FROM notes WHERE user_id=?").run(req.params.id);
    db.prepare("DELETE FROM reading_progress WHERE user_id=?").run(req.params.id);
    db.prepare("DELETE FROM reading_sessions WHERE user_id=?").run(req.params.id);
    db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);

    res.json({ message: "User deleted" });
  } catch (e) {
    console.error("Delete user:", e);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.get("/books", (req, res) => {
  try {
    const books = db.prepare(`
      SELECT b.*, 
        (SELECT COUNT(*) FROM chapters c WHERE c.book_id = b.id) as total_chapters,
        (SELECT COUNT(*) FROM reading_progress rp WHERE rp.book_id = b.id) as total_readers
      FROM books b ORDER BY b.created_at DESC
    `).all();
    res.json({ books });
  } catch (e) {
    console.error("Admin books:", e);
    res.status(500).json({ error: "Failed to get books" });
  }
});

router.post("/books", (req, res) => {
  try {
    const { title, author, description, coverUrl, genre, pages, publishedYear, rating, chapters } = req.body;
    if (!title || !author) return res.status(400).json({ error: "Title and author required" });

    const result = db.prepare("INSERT INTO books (title,author,description,cover_url,genre,pages,published_year,rating,uploaded_by) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(title, author, description || "", coverUrl || "", genre || "", pages || 0, publishedYear || 2024, rating || 0, req.user.id);

    if (chapters && Array.isArray(chapters)) {
      const insChapter = db.prepare("INSERT INTO chapters (book_id,chapter_number,title,content) VALUES (?,?,?,?)");
      chapters.forEach((ch, i) => {
        insChapter.run(result.lastInsertRowid, i + 1, ch.title || `Chapter ${i + 1}`, ch.content || "");
      });
    }

    const book = db.prepare("SELECT * FROM books WHERE id=?").get(result.lastInsertRowid);
    res.status(201).json({ message: "Book created", book });
  } catch (e) {
    console.error("Create book:", e);
    res.status(500).json({ error: "Failed to create book" });
  }
});

router.put("/books/:id", (req, res) => {
  try {
    const { title, author, description, coverUrl, genre, pages, publishedYear, rating } = req.body;
    const book = db.prepare("SELECT * FROM books WHERE id=?").get(req.params.id);
    if (!book) return res.status(404).json({ error: "Book not found" });

    db.prepare("UPDATE books SET title=?,author=?,description=?,cover_url=?,genre=?,pages=?,published_year=?,rating=? WHERE id=?")
      .run(title || book.title, author || book.author, description !== undefined ? description : book.description, coverUrl || book.cover_url, genre || book.genre, pages || book.pages, publishedYear || book.published_year, rating || book.rating, req.params.id);

    const updated = db.prepare("SELECT * FROM books WHERE id=?").get(req.params.id);
    res.json({ message: "Book updated", book: updated });
  } catch (e) {
    console.error("Update book:", e);
    res.status(500).json({ error: "Failed to update book" });
  }
});

router.delete("/books/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM chapters WHERE book_id=?").run(req.params.id);
    db.prepare("DELETE FROM reading_progress WHERE book_id=?").run(req.params.id);
    db.prepare("DELETE FROM notes WHERE book_id=?").run(req.params.id);
    db.prepare("DELETE FROM ai_chats WHERE book_id=?").run(req.params.id);
    db.prepare("DELETE FROM books WHERE id=?").run(req.params.id);
    res.json({ message: "Book deleted" });
  } catch (e) {
    console.error("Delete book:", e);
    res.status(500).json({ error: "Failed to delete book" });
  }
});

router.post("/books/:id/chapters", (req, res) => {
  try {
    const { title, content, chapterNumber } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Title and content required" });

    const book = db.prepare("SELECT * FROM books WHERE id=?").get(req.params.id);
    if (!book) return res.status(404).json({ error: "Book not found" });

    const maxChapter = db.prepare("SELECT MAX(chapter_number) as max FROM chapters WHERE book_id=?").get(req.params.id);
    const num = chapterNumber || (maxChapter.max || 0) + 1;

    const result = db.prepare("INSERT INTO chapters (book_id,chapter_number,title,content) VALUES (?,?,?,?)").run(req.params.id, num, title, content);
    const chapter = db.prepare("SELECT * FROM chapters WHERE id=?").get(result.lastInsertRowid);
    res.status(201).json({ message: "Chapter added", chapter });
  } catch (e) {
    console.error("Add chapter:", e);
    res.status(500).json({ error: "Failed to add chapter" });
  }
});

export default router;
