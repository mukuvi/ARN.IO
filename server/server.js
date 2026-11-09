import app from "./app.js";
import { initDatabase } from "./database.js";

const PORT = process.env.PORT || 3001;

if (!process.env.VERCEL) {
  initDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`ARN.IO Backend running on http://localhost:${PORT}`);
        console.log(`  Database: ${process.env.DATABASE_URL ? "DATABASE_URL" : "PG_*"}`);
        console.log(
          `  Storage: ${process.env.S3_BUCKET || process.env.R2_BUCKET ? "object storage" : "local disk"}`,
        );
        console.log(
          `  AI: ${
            process.env.GROQ_API_KEY
              ? "Groq"
              : process.env.GEMINI_API_KEY
                ? "Gemini"
                : process.env.OPENAI_API_KEY
                  ? "OpenAI"
                  : "Built-in (set GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY for external AI)"
          }`,
        );
      });
    })
    .catch((err) => {
      console.error("Failed to initialize database:", err);
      process.exit(1);
    });
}

export default app;
