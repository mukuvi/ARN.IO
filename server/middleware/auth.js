import jwt from "jsonwebtoken";
import pool from "../database.js";

const JWT_SECRET = "arn-io-secret-2024-change-in-production";

export function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role || "user" }, JWT_SECRET, { expiresIn: "7d" });
}

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access token required" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user is blacklisted
    const userCheck = await pool.query("SELECT blacklisted FROM users WHERE id = $1", [decoded.id]);
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ error: "Account no longer exists" });
    }
    if (userCheck.rows[0].blacklisted) {
      return res.status(403).json({ error: "Your account has been suspended. Contact an administrator." });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    if (err.message?.includes("suspended") || err.message?.includes("blacklisted")) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(403).json({ error: "Invalid or expired token" });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
