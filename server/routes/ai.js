import express from "express";
import pool from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

const SYSTEM_PROMPT = `You are ARN.IO's intelligent reading assistant. You help readers understand books, 
summarize chapters, explain concepts, answer questions about literature, and provide reading recommendations. 
Be concise, helpful, and engaging. When discussing a specific book, reference its actual content, themes, characters, and plot points accurately.
Format your responses with markdown for readability.`;

// Call Groq API (free, OpenAI-compatible — uses Llama 3)
async function callAI(message, bookContext, chatHistory) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured. Get a free key at https://console.groq.com/keys and set it in server/.env");

  const messages = [];

  // System prompt with book context baked in
  let systemContent = SYSTEM_PROMPT;
  if (bookContext) {
    systemContent += `\n\n--- BOOK INFORMATION ---\nTitle: ${bookContext.title}\nAuthor: ${bookContext.author}\nGenre: ${bookContext.genre}\nDescription: ${bookContext.description || "N/A"}`;
    if (bookContext.allChapters) {
      systemContent += `\n\n--- CHAPTER LIST ---\n${bookContext.allChapters.map(c => `Ch. ${c.chapter_number}: ${c.title}`).join("\n")}`;
    }
    if (bookContext.chapterContent) {
      systemContent += `\n\n--- CURRENT CHAPTER (Ch. ${bookContext.chapterNumber}: ${bookContext.chapterTitle}) ---\n${bookContext.chapterContent.slice(0, 8000)}`;
    }
  }
  messages.push({ role: "system", content: systemContent });

  // Build conversation history
  if (chatHistory.length > 0) {
    for (const h of chatHistory.slice(-8)) {
      messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: h.message });
    }
  }

  // Current user message
  messages.push({ role: "user", content: message });

  // Retry up to 3 times with backoff for rate limit errors
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    const data = await response.json();
    if (data.error) {
      const code = response.status;
      const msg = data.error.message || "Groq API error";
      if (code === 429) {
        lastError = new Error("QUOTA_EXCEEDED: Rate limited. Please wait a moment and try again.");
        console.warn(`Groq 429 (attempt ${attempt + 1}/3): ${msg}`);
        continue;
      }
      if (code === 401 || code === 403) {
        throw new Error("API_KEY_INVALID: Your Groq API key is invalid. Get a free key at https://console.groq.com/keys");
      }
      throw new Error(msg);
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("No response from Groq");
    return text;
  }
  throw lastError;
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

    // Call DeepSeek AI
    let reply;
    try {
      reply = await callAI(message, bookContext, history);
    } catch (aiErr) {
      console.error("AI error:", aiErr.message);
      if (aiErr.message.includes("QUOTA_EXCEEDED")) {
        reply = "⏳ The AI service is temporarily rate-limited. Please wait a moment and try again.";
      } else if (aiErr.message.includes("API_KEY_INVALID") || aiErr.message.includes("not configured")) {
        reply = "🔑 The AI API key is not configured or invalid. Please set a valid GROQ_API_KEY in the server's .env file. Get a free key at https://console.groq.com/keys";
      } else {
        reply = `Sorry, I couldn't process that right now. Please try again shortly. (${aiErr.message})`;
      }
    }

    // Save AI response
    await pool.query(
      "INSERT INTO ai_chats (user_id, book_id, role, message) VALUES ($1,$2,$3,$4)",
      [req.user.id, bookId || null, "assistant", reply]
    );

    res.json({ reply, source: "groq" });
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
