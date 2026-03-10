import express from "express";
import bcrypt from "bcryptjs";
import db from "../database.js";
import { generateToken, authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "All fields required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const picUrl = `https://ui-avatars.com/api/?background=3b82f6&color=fff&bold=true&name=${encodeURIComponent(name)}`;
    const result = db.prepare("INSERT INTO users (name,email,password,profile_pic,last_login) VALUES (?,?,?,?,datetime('now'))").run(name, email, hashed, picUrl);
    const user = db.prepare("SELECT id,name,email,profile_pic,created_at,last_login FROM users WHERE id=?").get(result.lastInsertRowid);

    // Auto-assign first 3 books as reading progress
    const books = db.prepare("SELECT id FROM books LIMIT 3").all();
    const ins = db.prepare("INSERT OR IGNORE INTO reading_progress (user_id,book_id,current_chapter,progress_percent,streak_days) VALUES (?,?,?,?,?)");
    books.forEach((b, i) => ins.run(user.id, b.id, 1, (i + 1) * 15, i + 1));

    res.status(201).json({ message: "Account created", token: generateToken(user), user: { id: user.id, name: user.name, email: user.email, profilePic: user.profile_pic, lastLogin: user.last_login } });
  } catch (e) {
    console.error("Register:", e);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    db.prepare("UPDATE users SET last_login=datetime('now') WHERE id=?").run(user.id);

    res.json({ message: "Login successful", token: generateToken(user), user: { id: user.id, name: user.name, email: user.email, profilePic: user.profile_pic, lastLogin: new Date().toISOString() } });
  } catch (e) {
    console.error("Login:", e);
    res.status(500).json({ error: "Login failed" });
  }
});

// Get current user
router.get("/me", authenticateToken, (req, res) => {
  const user = db.prepare("SELECT id,name,email,profile_pic,created_at,last_login FROM users WHERE id=?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: { id: user.id, name: user.name, email: user.email, profilePic: user.profile_pic, createdAt: user.created_at, lastLogin: user.last_login } });
});

export default router;
