import express from "express";
import bcrypt from "bcryptjs";
import pool from "../database.js";
import { generateToken, authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "All fields required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const picUrl = `https://ui-avatars.com/api/?background=f97316&color=fff&bold=true&name=${encodeURIComponent(name)}`;
    const result = await pool.query(
      "INSERT INTO users (name,email,password,profile_pic,role,last_login) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *",
      [name, email, hashed, picUrl, "user"]
    );
    const user = result.rows[0];

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

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    await pool.query("UPDATE users SET last_login=NOW() WHERE id=$1", [user.id]);

    res.json({ message: "Login successful", token: generateToken(user), user: { id: user.id, name: user.name, email: user.email, profilePic: user.profile_pic, role: user.role, bio: user.bio, lastLogin: new Date().toISOString() } });
  } catch (e) {
    console.error("Login:", e);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id,name,email,profile_pic,role,bio,created_at,last_login FROM users WHERE id=$1", [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: { id: user.id, name: user.name, email: user.email, profilePic: user.profile_pic, role: user.role, bio: user.bio, createdAt: user.created_at, lastLogin: user.last_login } });
  } catch (e) {
    console.error("Get me:", e);
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { name, bio, profilePic } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE id=$1", [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const newName = name || user.name;
    const newBio = bio !== undefined ? bio : user.bio;
    const newPic = profilePic || user.profile_pic;

    const updated = await pool.query(
      "UPDATE users SET name=$1, bio=$2, profile_pic=$3 WHERE id=$4 RETURNING id,name,email,profile_pic,role,bio,created_at,last_login",
      [newName, newBio, newPic, req.user.id]
    );
    const u = updated.rows[0];

    res.json({ message: "Profile updated", user: { id: u.id, name: u.name, email: u.email, profilePic: u.profile_pic, role: u.role, bio: u.bio, createdAt: u.created_at, lastLogin: u.last_login }, token: generateToken(u) });
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

    const result = await pool.query("SELECT * FROM users WHERE id=$1", [req.user.id]);
    const user = result.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password=$1 WHERE id=$2", [hashed, req.user.id]);
    res.json({ message: "Password changed successfully" });
  } catch (e) {
    console.error("Change password:", e);
    res.status(500).json({ error: "Failed to change password" });
  }
});

router.delete("/account", authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE id=$1", [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Incorrect password" });

    await pool.query("DELETE FROM ai_chats WHERE user_id=$1", [req.user.id]);
    await pool.query("DELETE FROM notes WHERE user_id=$1", [req.user.id]);
    await pool.query("DELETE FROM reading_sessions WHERE user_id=$1", [req.user.id]);
    await pool.query("DELETE FROM reading_progress WHERE user_id=$1", [req.user.id]);
    await pool.query("DELETE FROM users WHERE id=$1", [req.user.id]);

    res.json({ message: "Account deleted" });
  } catch (e) {
    console.error("Delete account:", e);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const booksInProgress = (await pool.query("SELECT COUNT(*) as count FROM reading_progress WHERE user_id=$1", [userId])).rows[0].count;
    const totalNotes = (await pool.query("SELECT COUNT(*) as count FROM notes WHERE user_id=$1", [userId])).rows[0].count;
    const totalChats = (await pool.query("SELECT COUNT(*) as count FROM ai_chats WHERE user_id=$1 AND role='user'", [userId])).rows[0].count;

    const progress = (await pool.query("SELECT progress_percent, streak_days FROM reading_progress WHERE user_id=$1", [userId])).rows;
    const avgProgress = progress.length > 0 ? Math.round(progress.reduce((a, p) => a + parseFloat(p.progress_percent), 0) / progress.length) : 0;
    const completedBooks = progress.filter(p => parseFloat(p.progress_percent) >= 100).length;

    // Real streak from daily_streaks table
    const streakDates = (await pool.query("SELECT DISTINCT streak_date FROM daily_streaks WHERE user_id = $1 ORDER BY streak_date DESC", [userId])).rows;
    let currentStreak = 0, longestStreak = 0;
    if (streakDates.length > 0) {
      const dates = streakDates.map(r => { const d = new Date(r.streak_date); d.setHours(0,0,0,0); return d; });
      const today = new Date(); today.setHours(0,0,0,0);
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      if (dates[0].getTime() === today.getTime() || dates[0].getTime() === yesterday.getTime()) {
        currentStreak = 1;
        for (let i = 1; i < dates.length; i++) {
          if ((dates[i-1].getTime() - dates[i].getTime()) / 86400000 === 1) currentStreak++; else break;
        }
      }
      let temp = 1;
      for (let i = 1; i < dates.length; i++) {
        if ((dates[i-1].getTime() - dates[i].getTime()) / 86400000 === 1) { temp++; longestStreak = Math.max(longestStreak, temp); }
        else temp = 1;
      }
      longestStreak = Math.max(longestStreak, currentStreak, temp);
    }
    const totalStreak = currentStreak;
    const maxStreak = longestStreak;

    const sessions = (await pool.query("SELECT COALESCE(SUM(minutes_read),0) as totalminutes, COALESCE(SUM(pages_read),0) as totalpages, COALESCE(SUM(chapters_read),0) as totalchapters FROM reading_sessions WHERE user_id=$1", [userId])).rows[0];

    const recentActivity = (await pool.query(`
      SELECT rp.last_read, b.title FROM reading_progress rp 
      JOIN books b ON b.id = rp.book_id 
      WHERE rp.user_id=$1 ORDER BY rp.last_read DESC LIMIT 5
    `, [userId])).rows;

    const favoriteGenreResult = (await pool.query(`
      SELECT b.genre, COUNT(*) as count FROM reading_progress rp 
      JOIN books b ON b.id = rp.book_id 
      WHERE rp.user_id=$1 GROUP BY b.genre ORDER BY count DESC LIMIT 1
    `, [userId])).rows;

    res.json({
      stats: {
        booksInProgress: parseInt(booksInProgress), completedBooks, totalNotes: parseInt(totalNotes), totalChats: parseInt(totalChats),
        avgProgress, totalStreak, maxStreak,
        totalMinutes: parseInt(sessions.totalminutes) || 0,
        totalPages: parseInt(sessions.totalpages) || 0,
        totalChaptersRead: parseInt(sessions.totalchapters) || 0,
        totalReadingDays: streakDates.length,
        recentActivity,
        favoriteGenre: favoriteGenreResult.length > 0 ? favoriteGenreResult[0].genre : "None yet"
      }
    });
  } catch (e) {
    console.error("Stats:", e);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

export default router;
