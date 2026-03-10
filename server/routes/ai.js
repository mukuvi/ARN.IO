import express from "express";
import pool from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

const SYSTEM_PROMPT = `You are ARN.IO's intelligent reading assistant. You help readers understand books, 
summarize chapters, explain concepts, answer questions about literature, and provide reading recommendations. 
Be concise, helpful, and engaging. When discussing a specific book, reference its actual content, themes, characters, and plot points accurately.
Format your responses with markdown for readability.`;

// Call Gemini API with real book context
async function callGemini(message, bookContext, chatHistory) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured. Please set it in your environment variables.");

  const contents = [];

  // Build conversation history
  if (chatHistory.length > 0) {
    for (const h of chatHistory.slice(-8)) {
      contents.push({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.message }],
      });
    }
  }

  // Build the current user message with book context
  let userMessage = SYSTEM_PROMPT + "\n\n";
  if (bookContext) {
    userMessage += `--- BOOK INFORMATION ---\nTitle: ${bookContext.title}\nAuthor: ${bookContext.author}\nGenre: ${bookContext.genre}\nDescription: ${bookContext.description || "N/A"}\n\n`;
    if (bookContext.chapterContent) {
      userMessage += `--- CURRENT CHAPTER (Ch. ${bookContext.chapterNumber}: ${bookContext.chapterTitle}) ---\n${bookContext.chapterContent.slice(0, 8000)}\n\n`;
    }
    if (bookContext.allChapters) {
      userMessage += `--- CHAPTER LIST ---\n${bookContext.allChapters.map(c => `Ch. ${c.chapter_number}: ${c.title}`).join("\n")}\n\n`;
    }
  }
  userMessage += `--- USER QUESTION ---\n${message}`;

  contents.push({ role: "user", parts: [{ text: userMessage }] });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Gemini API error");
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  return text;
}

// Chat with AI about a book
router.post("/chat", authenticateToken, async (req, res) => {
  try {
    const { bookId, message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    // Gather book context if a book is selected
    let bookContext = null;
    if (bookId) {
      const book = (await pool.query("SELECT id, title, author, genre, description FROM books WHERE id=$1", [bookId])).rows[0];
      if (book) {
        bookContext = { title: book.title, author: book.author, genre: book.genre, description: book.description };

        // Get chapter list
        const chapters = (await pool.query("SELECT chapter_number, title FROM chapters WHERE book_id=$1 ORDER BY chapter_number", [bookId])).rows;
        bookContext.allChapters = chapters;

        // Get current chapter the user is reading
        const prog = (await pool.query("SELECT current_chapter FROM reading_progress WHERE user_id=$1 AND book_id=$2", [req.user.id, bookId])).rows[0];
        const chapNum = prog?.current_chapter || 1;
        const chapter = (await pool.query("SELECT chapter_number, title, content FROM chapters WHERE book_id=$1 AND chapter_number=$2", [bookId, chapNum])).rows[0];
        if (chapter) {
          bookContext.chapterNumber = chapter.chapter_number;
          bookContext.chapterTitle = chapter.title;
          bookContext.chapterContent = chapter.content;
        }
      }
    } else {
      // General chat — provide user's library context for recommendations
      const userBooks = (await pool.query(`
        SELECT b.title, b.author, b.genre, rp.progress_percent 
        FROM reading_progress rp JOIN books b ON b.id = rp.book_id 
        WHERE rp.user_id = $1 ORDER BY rp.last_read DESC LIMIT 10
      `, [req.user.id])).rows;
      if (userBooks.length > 0) {
        bookContext = {
          title: "General Library Chat",
          author: "",
          genre: "",
          description: `User's reading history:\n${userBooks.map(b => `- "${b.title}" by ${b.author} (${b.genre}, ${b.progress_percent}% read)`).join("\n")}`,
        };
      }
    }

    // Save user message
    await pool.query(
      "INSERT INTO ai_chats (user_id, book_id, role, message) VALUES ($1,$2,$3,$4)",
      [req.user.id, bookId || null, "user", message]
    );

    // Get chat history
    let history;
    if (bookId) {
      history = (await pool.query("SELECT role, message FROM ai_chats WHERE user_id=$1 AND book_id=$2 ORDER BY created_at DESC LIMIT 10", [req.user.id, bookId])).rows.reverse();
    } else {
      history = (await pool.query("SELECT role, message FROM ai_chats WHERE user_id=$1 AND book_id IS NULL ORDER BY created_at DESC LIMIT 10", [req.user.id])).rows.reverse();
    }

    // Call Gemini
    let reply;
    try {
      reply = await callGemini(message, bookContext, history);
    } catch (aiErr) {
      console.error("Gemini error:", aiErr.message);
      reply = `Sorry, I couldn't process that right now. ${aiErr.message.includes("API_KEY") ? "The AI API key needs to be configured." : "Please try again."}`;
    }

    // Save AI response
    await pool.query(
      "INSERT INTO ai_chats (user_id, book_id, role, message) VALUES ($1,$2,$3,$4)",
      [req.user.id, bookId || null, "assistant", reply]
    );

    res.json({ reply, source: "gemini" });
  } catch (e) {
    console.error("AI chat:", e);
    res.status(500).json({ error: "AI chat failed" });
  }
});

// Get chat history
router.get("/history/:bookId", authenticateToken, async (req, res) => {
  try {
    const chats = (await pool.query("SELECT role, message, created_at FROM ai_chats WHERE user_id=$1 AND book_id=$2 ORDER BY created_at ASC", [req.user.id, req.params.bookId])).rows;
    res.json({ chats });
  } catch (e) {
    console.error("Chat history:", e);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Clear chat history
router.delete("/history/:bookId", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM ai_chats WHERE user_id=$1 AND book_id=$2", [req.user.id, req.params.bookId]);
    res.json({ message: "Chat history cleared" });
  } catch (e) {
    console.error("Clear history:", e);
    res.status(500).json({ error: "Failed to clear" });
  }
});

export default router;
