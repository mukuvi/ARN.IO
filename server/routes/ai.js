import express from "express";
import db from "../database.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

const SYSTEM_PROMPT = `You are ARN.IO's intelligent reading assistant. You help readers understand books, 
summarize chapters, explain concepts, answer questions about literature, and provide reading recommendations. 
Be concise, helpful, and engaging. When discussing a specific book, reference its themes, characters, and plot points accurately.`;

// Built-in AI responses for common book topics (works without external API key)
function getBuiltInResponse(message, bookTitle) {
  const msg = message.toLowerCase();
  
  const responses = {
    summary: [
      `Here's a summary of "${bookTitle}":\n\nThis is a compelling work that explores fundamental themes relevant to its genre. The author masterfully weaves together narrative elements to create an engaging reading experience. The key themes include personal growth, understanding complex systems, and the human condition.\n\nWould you like me to go deeper into any specific aspect?`,
    ],
    theme: [
      `The major themes in "${bookTitle}" include:\n\n• **Self-discovery** — Characters undergo significant personal transformation\n• **Conflict between tradition and progress** — A recurring tension throughout\n• **The power of knowledge** — Education and learning as transformative forces\n• **Human resilience** — Characters overcoming adversity\n\nWhich theme interests you most?`,
    ],
    character: [
      `The characters in "${bookTitle}" are richly developed:\n\n• The **protagonist** drives the narrative through their personal journey and growth\n• **Supporting characters** provide contrast and depth to the main storyline\n• The **antagonistic forces** create meaningful conflict that propels the plot\n\nWould you like to discuss a specific character?`,
    ],
    recommend: [
      `Based on your interest in "${bookTitle}", you might also enjoy:\n\n📚 **Similar in theme:** Works that explore comparable ideas and moral questions\n📚 **Same genre:** Other highly-rated books in this category\n📚 **Same author:** Other works by this author that showcase similar writing style\n\nWould you like more specific recommendations?`,
    ],
    explain: [
      `Great question! Let me break this down:\n\nThe concept you're asking about relates to one of the core ideas in "${bookTitle}". The author uses this as a vehicle to explore deeper meanings about human nature and society.\n\nThe key takeaway is that understanding comes through both intellectual analysis and emotional engagement with the material.\n\nWant me to elaborate further?`,
    ],
    help: [
      `I can help you with "${bookTitle}" in several ways:\n\n📖 **Summarize** — Get chapter or full book summaries\n🎭 **Characters** — Analyze character development and relationships\n🎨 **Themes** — Explore major themes and motifs\n💡 **Explain** — Break down complex passages or concepts\n📚 **Recommend** — Find similar books you might enjoy\n✍️ **Discuss** — Have a conversation about the book\n\nWhat would you like to explore?`,
    ],
  };

  if (msg.includes("summar")) return responses.summary[0];
  if (msg.includes("theme") || msg.includes("meaning") || msg.includes("about")) return responses.theme[0];
  if (msg.includes("character") || msg.includes("who")) return responses.character[0];
  if (msg.includes("recommend") || msg.includes("similar") || msg.includes("like this")) return responses.recommend[0];
  if (msg.includes("explain") || msg.includes("what") || msg.includes("why") || msg.includes("how")) return responses.explain[0];
  if (msg.includes("help") || msg.includes("can you") || msg.includes("what can")) return responses.help[0];

  return `That's an interesting question about "${bookTitle}"! Based on the text, I can offer this perspective:\n\nThe work addresses your question through its narrative structure and thematic elements. The author's approach suggests a nuanced view that rewards careful reading and reflection.\n\nFeel free to ask more specific questions and I'll provide targeted insights!`;
}

// Try external AI API (Google Gemini - free tier available)
async function callExternalAI(message, bookTitle, chatHistory) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) return null; // Fall back to built-in
  
  try {
    if (process.env.GEMINI_API_KEY) {
      // Google Gemini API (free tier: 15 RPM)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nBook: "${bookTitle}"\n\nUser question: ${message}` }] },
            ],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
          }),
        }
      );
      const data = await response.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    }
    
    if (process.env.OPENAI_API_KEY) {
      // OpenAI API
      const messages = [
        { role: "system", content: `${SYSTEM_PROMPT}\n\nCurrently discussing: "${bookTitle}"` },
        ...chatHistory.slice(-6).map(h => ({ role: h.role, content: h.message })),
        { role: "user", content: message },
      ];
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-3.5-turbo", messages, max_tokens: 1024, temperature: 0.7 }),
      });
      const data = await response.json();
      return data?.choices?.[0]?.message?.content || null;
    }
  } catch (e) {
    console.error("External AI error:", e.message);
    return null;
  }
  return null;
}

// Chat with AI about a book
router.post("/chat", authenticateToken, async (req, res) => {
  try {
    const { bookId, message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    let bookTitle = "your book";
    if (bookId) {
      const book = db.prepare("SELECT title FROM books WHERE id=?").get(bookId);
      if (book) bookTitle = book.title;
    }

    // Save user message
    db.prepare("INSERT INTO ai_chats (user_id, book_id, role, message) VALUES (?,?,?,?)")
      .run(req.user.id, bookId || null, "user", message);

    // Get chat history
    const history = db.prepare("SELECT role, message FROM ai_chats WHERE user_id=? AND book_id=? ORDER BY created_at DESC LIMIT 10")
      .all(req.user.id, bookId || null).reverse();

    // Try external AI first, fall back to built-in
    let reply = await callExternalAI(message, bookTitle, history);
    if (!reply) {
      reply = getBuiltInResponse(message, bookTitle);
    }

    // Save AI response
    db.prepare("INSERT INTO ai_chats (user_id, book_id, role, message) VALUES (?,?,?,?)")
      .run(req.user.id, bookId || null, "assistant", reply);

    res.json({ reply, source: reply === getBuiltInResponse(message, bookTitle) ? "built-in" : "ai-api" });
  } catch (e) {
    console.error("AI chat:", e);
    res.status(500).json({ error: "AI chat failed" });
  }
});

// Get chat history
router.get("/history/:bookId", authenticateToken, (req, res) => {
  try {
    const chats = db.prepare("SELECT role, message, created_at FROM ai_chats WHERE user_id=? AND book_id=? ORDER BY created_at ASC")
      .all(req.user.id, req.params.bookId);
    res.json({ chats });
  } catch (e) {
    console.error("Chat history:", e);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Clear chat history
router.delete("/history/:bookId", authenticateToken, (req, res) => {
  try {
    db.prepare("DELETE FROM ai_chats WHERE user_id=? AND book_id=?").run(req.user.id, req.params.bookId);
    res.json({ message: "Chat history cleared" });
  } catch (e) {
    console.error("Clear history:", e);
    res.status(500).json({ error: "Failed to clear" });
  }
});

export default router;
