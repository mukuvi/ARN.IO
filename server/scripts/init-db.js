import "dotenv/config";
import pool, { initDatabase } from "../database.js";

initDatabase()
  .then(() => pool.end())
  .then(() => {
    console.log("Database initialized");
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exitCode = 1;
  });
