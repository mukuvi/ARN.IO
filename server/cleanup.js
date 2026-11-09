import pool from "./database.js";
import { deleteObject } from "./storage.js";

const RETENTION_DAYS = Number(process.env.UPLOAD_RETENTION_DAYS || 5);

export async function cleanupExpiredUploads() {
  const { rows } = await pool.query(
    `SELECT b.id, b.file_path
     FROM books b
     JOIN users u ON u.id = b.uploaded_by
     WHERE u.role <> 'admin'
       AND b.created_at < NOW() - ($1::int * INTERVAL '1 day')`,
    [RETENTION_DAYS],
  );

  if (rows.length === 0) {
    return { deleted: 0, objectsDeleted: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const book of rows) {
      await client.query("DELETE FROM ai_chats WHERE book_id=$1", [book.id]);
      await client.query("DELETE FROM notes WHERE book_id=$1", [book.id]);
      await client.query("DELETE FROM reading_sessions WHERE book_id=$1", [
        book.id,
      ]);
      await client.query("DELETE FROM reading_progress WHERE book_id=$1", [
        book.id,
      ]);
      await client.query("DELETE FROM chapters WHERE book_id=$1", [book.id]);
      await client.query("DELETE FROM books WHERE id=$1", [book.id]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  let objectsDeleted = 0;
  for (const book of rows) {
    if (book.file_path && book.file_path.startsWith("uploads/")) {
      try {
        await deleteObject(book.file_path);
        objectsDeleted += 1;
      } catch (error) {
        console.error("Delete storage object:", error.message);
      }
    }
  }

  return { deleted: rows.length, objectsDeleted };
}
