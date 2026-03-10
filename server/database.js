import pg from "pg";
import bcryptjs from "bcryptjs";

const pool = new pg.Pool({
  user: process.env.PG_USER || "mukuvi",
  password: process.env.PG_PASSWORD || "arnio2024",
  host: process.env.PG_HOST || "localhost",
  port: parseInt(process.env.PG_PORT || "5432"),
  database: process.env.PG_DATABASE || "arnio",
});

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        profile_pic TEXT DEFAULT '',
        role TEXT DEFAULT 'user',
        bio TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_login TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        description TEXT,
        cover_url TEXT,
        genre TEXT,
        pages INTEGER DEFAULT 0,
        published_year INTEGER,
        rating REAL DEFAULT 0,
        uploaded_by INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS chapters (
        id SERIAL PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        chapter_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        UNIQUE(book_id, chapter_number)
      );

      CREATE TABLE IF NOT EXISTS reading_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        current_chapter INTEGER DEFAULT 1,
        progress_percent REAL DEFAULT 0,
        streak_days INTEGER DEFAULT 0,
        last_read TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, book_id)
      );

      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        chapter_number INTEGER,
        content TEXT NOT NULL,
        note_type TEXT DEFAULT 'note',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_chats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id INTEGER,
        role TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reading_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        chapters_read INTEGER DEFAULT 0,
        minutes_read INTEGER DEFAULT 0,
        pages_read INTEGER DEFAULT 0,
        session_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS daily_streaks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        streak_date DATE NOT NULL,
        chapters_completed INTEGER DEFAULT 0,
        books_completed INTEGER DEFAULT 0,
        UNIQUE(user_id, streak_date)
      );
    `);

    // Add columns if they don't exist (for existing databases)
    try { await client.query("ALTER TABLE reading_progress ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW()"); } catch {}
    try { await client.query("ALTER TABLE reading_progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ"); } catch {}
    try { await client.query("ALTER TABLE reading_sessions ADD COLUMN IF NOT EXISTS chapters_read INTEGER DEFAULT 0"); } catch {}
    try { await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS blacklisted BOOLEAN DEFAULT false"); } catch {}
    try { await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ"); } catch {}
    try { await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS blacklist_reason TEXT DEFAULT ''"); } catch {}
    try { await client.query("ALTER TABLE books ADD COLUMN IF NOT EXISTS full_text TEXT DEFAULT ''"); } catch {}
    try { await client.query("ALTER TABLE books ADD COLUMN IF NOT EXISTS file_path TEXT DEFAULT ''"); } catch {}

    // Seed admin only
    const adminCheck = await client.query("SELECT id FROM users WHERE email = $1", ["mukuvi@arnio.com"]);
    if (adminCheck.rows.length === 0) {
      const hashedPw = bcryptjs.hashSync("mukuvi", 10);
      await client.query(
        "INSERT INTO users (name, email, password, profile_pic, role, bio, last_login) VALUES ($1,$2,$3,$4,$5,$6,NOW())",
        ["Mukuvi", "mukuvi@arnio.com", hashedPw, "https://ui-avatars.com/api/?background=f97316&color=fff&bold=true&name=Mukuvi", "admin", "ARN.IO Platform Administrator"]
      );
      console.log("Admin account created: mukuvi@arnio.com");
    }

    console.log("Database initialized");
  } finally {
    client.release();
  }
}

export default pool;
