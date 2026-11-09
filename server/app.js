import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import bookRoutes from "./routes/books.js";
import progressRoutes from "./routes/progress.js";
import notesRoutes from "./routes/notes.js";
import aiRoutes from "./routes/ai.js";
import adminRoutes from "./routes/admin.js";

const app = express();

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const VERCEL_ORIGIN = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || LOCAL_ORIGIN.test(origin)) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (
        VERCEL_ORIGIN.test(origin) &&
        process.env.ALLOW_VERCEL_PREVIEWS !== "false"
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "4mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);

const health = (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "2.1.0-vercel",
    storage: process.env.S3_BUCKET || process.env.R2_BUCKET ? "object storage" : "local",
  });
};

app.get("/api/health", health);
app.get("/health", health);

export default app;
