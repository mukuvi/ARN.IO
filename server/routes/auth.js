import express from "express";
import bcrypt from "bcryptjs";
import db from "../database.js";
import { generateToken, authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "All fields required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const picUrl = `https://ui-avatars.com/api/?background=f97316&color=fff&bold=true&name=${encodeURIComponent(name)}`;
    const result = db.prepare("INSERT INTO users (name,email,password,profile_pic,role,last_login) VALUES (?,?,?,?,?,datetime('now'))").run(name, email, hashed, picUrl, "user");
    const user = db.prepare("SELECT id,name,email,profile_pic,role,bio,created_at,last_login FROM users WHERE id=?").get(result.lastInsertRowid);

    const books = db.prepare("SELECT id FROM books LIMIT 3").all();
    const ins = db.prepare("INSERT OR IGNORE INTO reading_progress (user_id,book_id,current_chapter,progress_percent,streak_days) VALUES (?,?,?,?,?)");
    books.forEach((b, i) => ins.run(user.id, b.id, 1, (i + 1) * 15, i + 1));

    res.status(201).json({ message: "Account created", token: generateToken(user), user: { id: user.id, name: user.name, email: user.email, profilePic: user.profile_pic, role: user.role, bio: user.bio, lastLogin: user.last_login } });
  } catch (e) {
    console.error("Register:", e);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    db.prepare("UPDATE users SET last_login=datetime('now') WHERE id=?").run(user.id);

    res.json({ message: "Login successful", token: generateToken(user), user: { id: user.id, name: user.name, email: user.email, profilePic: user.profile_pic, role: user.role, bio: user.bio, lastLogin: new Date().toISOString() } });
  } catch (e) {
    console.error("Login:", e);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", authenticateToken, (req, res) => {
  const user = db.prepare("SELECT id,name,email,profile_pic,role,bio,created_at,last_login FROM users WHERE id=?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { id: user.id, name: user.name, email: user.email, profilePic: user.profile_pic, role: user.role, bio: user.bio, createdAt: user.created_at, lastLogin: user.last_login } });
});

router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { name, bio, profilePic } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const newName = name || user.name;
    const newBio = bio !== undefined ? bio : user.bio;
    const newPic = profilePic || user.profile_pic;

    db.prepare("UPDATE users SET name=?, bio=?, profile_pic=? WHERE id=?").run(newName, newBio, newPic, req.user.id);
    const updated = db.prepare("SELECT id,name,email,profile_pic,role,bio,created_at,last_login FROM users WHERE id=?").get(req.user.id);

    res.json({ message: "Profile updated", user: { id: updated.id, name: updated.name, email: updated.email, profilePic: updated.profile_pic, role: updated.role, bio: updated.bio, createdAt: updated.created_at, lastLogin: updated.last_login }, token: generateToken(updated) });
  } catch (e) {
    console.error("Update profile:", e);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.put("/password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both passwords required" });
    if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });

    const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    db.prepare("UPDATE users SET password=? WHERE id=?").run(hashed, req.user.id);
    res.json({ message: "Password changed successfully" });
  } catch (e) {
    console.error("Change password:", e);
    res.status(500).json({ error: "Failed to change password" });
  }
});

router.delete("/account", authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Incorrect password" });

    db.prepare("DELETE FROM ai_chats WHERE user_id=?").run(req.user.id);
    db.prepare("DELETE FROM notes WHERE user_id=?").run(req.user.id);
    db.prepare("DELETE FROM reading_progress WHERE user_id=?").run(req.user.id);
    db.prepare("DELETE FROM reading_sessions WHERE user_id=?").run(req.user.id);
    db.prepare("DELETE FROM users WHERE id=?").run(req.user.id);

    res.json({ message: "Account deleted" });
  } catch (e) {
    console.error("Delete account:", e);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

router.get("/stats", authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const booksInProgress = db.prepare("SELECT COUNT(*) as count FROM reading_progress WHERE user_id=?").get(userId).count;
    const totalNotes = db.prepare("SELECT COUNT(*) as count FROM notes WHERE user_id=?").get(userId).count;
    const totalChats = db.prepare("SELECT COUNT(*) as count FROM ai_chats WHERE user_id=? AND role='user'").get(userId).count;

    const progress = db.prepare("SELECT progress_percent, streak_days FROM reading_progress WHERE user_id=?").all(userId);
    const avgProgress = progress.length > 0 ? Math.round(progress.reduce((a, p) => a + p.progress_percent, 0) / progress.length) : 0;
    const totalStreak = progress.reduce((a, p) => a + (p.streak_days || 0), 0);
    const maxStreak = progress.length > 0 ? Math.max(...progress.map(p => p.streak_days || 0)) : 0;

    const completedBooks = progress.filter(p => p.progress_percent >= 100).length;

    const sessions = db.prepare("SELECT SUM(minutes_read) as totalMinutes, SUM(pages_read) as totalPages FROM reading_sessions WHERE user_id=?").get(userId);

    const recentActivity = db.prepare(`
      SELECT rp.last_read, b.title FROM reading_progress rp 
      JOIN books b ON b.id = rp.book_id 
      WHERE rp.user_id=? ORDER BY rp.last_read DESC LIMIT 5
    `).all(userId);

    const favoriteGenre = db.prepare(`
      SELECT b.genre, COUNT(*) as count FROM reading_progress rp 
      JOIN books b ON b.id = rp.book_id 
      WHERE rp.user_id=? GROUP BY b.genre ORDER BY count DESC LIMIT 1
    `).get(userId);

    res.json({
      stats: {
        booksInProgress, completedBooks, totalNotes, totalChats,
        avgProgress, totalStreak, maxStreak,
        totalMinutes: sessions.totalMinutes || 0,
        totalPages: sessions.totalPages || 0,
        recentActivity,
        favoriteGenre: favoriteGenre?.genre || "None yet"
      }
    });
  } catch (e) {
    console.error("Stats:", e);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
