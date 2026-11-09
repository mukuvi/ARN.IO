const API = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/+$/, "");

const CONNECTION_ERROR =
  "Unable to connect to ARN.IO. Check your connection and try again.";
const SERVER_ERROR =
  "ARN.IO is having trouble right now. Please try again in a moment.";

function headers() {
  const h = { "Content-Type": "application/json" };
  const token = localStorage.getItem("arn_token");
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, { ...options, headers: headers() });
  } catch {
    throw new Error(CONNECTION_ERROR);
  }

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    if (res.status >= 500) throw new Error(SERVER_ERROR);
    throw new Error(data.error || "Something went wrong. Please try again.");
  }

  return data;
}

export const register = (name, email, password) =>
  request("/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
export const login = (email, password) =>
  request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const getMe = () => request("/auth/me");
export const updateProfile = (data) =>
  request("/auth/profile", { method: "PUT", body: JSON.stringify(data) });
export const changePassword = (currentPassword, newPassword) =>
  request("/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) });
export const deleteAccount = (password) =>
  request("/auth/account", { method: "DELETE", body: JSON.stringify({ password }) });
export const getStats = () => request("/auth/stats");

export const getBooks = () => request("/books");
export const getBook = (id) => request(`/books/${id}`);
export const getChapter = (bookId, chapterNum) => request(`/books/${bookId}/chapters/${chapterNum}`);
export const getFullText = (bookId) => request(`/books/${bookId}/full-text`);
export const getBookFileUrl = (bookId) => {
  const token = localStorage.getItem("arn_token");
  return `${API}/books/${bookId}/file?token=${token}`;
};
export async function getBookFile(bookId) {
  const token = localStorage.getItem("arn_token");
  let res;
  try {
    res = await fetch(`${API}/books/${bookId}/file`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
  } catch {
    throw new Error("The book file could not be loaded. Check your connection and try again.");
  }
  if (!res.ok) throw new Error("The book file is not available right now.");
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}
export const searchBooks = (query) => request(`/books/search/${encodeURIComponent(query)}`);
export const deleteBook = (bookId) => request(`/books/${bookId}`, { method: "DELETE" });
export const searchBooksOnline = (query) => request(`/books/search-online/${encodeURIComponent(query)}`);
async function createUpload(file) {
  let res;
  try {
    res = await fetch(`${API}/books/upload-url`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      }),
    });
  } catch {
    throw new Error(CONNECTION_ERROR);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 503) return null;
  if (!res.ok) throw new Error(data.error || "The upload could not be started. Try again.");
  return data;
}

export async function uploadDocument({ title, author, genre, content, file }) {
  const token = localStorage.getItem("arn_token");

  if (file) {
    const upload = await createUpload(file);
    if (upload) {
      let put;
      try {
        put = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });
      } catch {
        throw new Error(
          "The file could not be uploaded. Check your connection and try again.",
        );
      }
      if (!put.ok) {
        throw new Error("The file could not be uploaded. Please try again.");
      }

      return request("/books/upload", {
        method: "POST",
        body: JSON.stringify({
          title,
          author,
          genre,
          content: content && !content.startsWith("[") ? content : undefined,
          objectKey: upload.key,
          originalName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
    }
  }

  const h = {};
  if (token) h["Authorization"] = `Bearer ${token}`;

  let body;
  if (file) {
    body = new FormData();
    body.append("file", file);
    if (title) body.append("title", title);
    if (author) body.append("author", author);
    if (genre) body.append("genre", genre);
    if (content) body.append("content", content);
  } else {
    h["Content-Type"] = "application/json";
    body = JSON.stringify({ title, author, genre, content });
  }

  let res;
  try {
    res = await fetch(`${API}/books/upload`, { method: "POST", headers: h, body });
  } catch {
    throw new Error(CONNECTION_ERROR);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status >= 500) throw new Error(SERVER_ERROR);
    throw new Error(data.error || "The document could not be uploaded. Please try again.");
  }
  return data;
}

export const getProgress = () => request("/progress");
export const getStreak = () => request("/progress/streak");
export const updateProgress = (bookId, data) =>
  request(`/progress/${bookId}`, { method: "PUT", body: JSON.stringify(data) });
export const removeFromList = (bookId) =>
  request(`/progress/${bookId}`, { method: "DELETE" });

export const createNote = (bookId, chapterNumber, content, noteType) =>
  request("/notes", { method: "POST", body: JSON.stringify({ bookId, chapterNumber, content, noteType }) });
export const getBookNotes = (bookId) => request(`/notes/book/${bookId}`);
export const deleteNote = (id) => request(`/notes/${id}`, { method: "DELETE" });

export const aiChat = (bookId, message) =>
  request("/ai/chat", { method: "POST", body: JSON.stringify({ bookId, message }) });
export const getAiHistory = (bookId) => request(`/ai/history/${bookId}`);
export const clearAiHistory = (bookId) => request(`/ai/history/${bookId}`, { method: "DELETE" });

export const adminGetStats = () => request("/admin/stats");
export const adminGetUsers = () => request("/admin/users");
export const adminUpdateRole = (userId, role) =>
  request(`/admin/users/${userId}/role`, { method: "PUT", body: JSON.stringify({ role }) });
export const adminDeleteUser = (userId) =>
  request(`/admin/users/${userId}`, { method: "DELETE" });
export const adminBlacklistUser = (userId, blacklisted, reason) =>
  request(`/admin/users/${userId}/blacklist`, { method: "PUT", body: JSON.stringify({ blacklisted, reason }) });
export const adminGetBooks = () => request("/admin/books");
export const adminCreateBook = (data) =>
  request("/admin/books", { method: "POST", body: JSON.stringify(data) });
export const adminUpdateBook = (id, data) =>
  request(`/admin/books/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const adminDeleteBook = (id) =>
  request(`/admin/books/${id}`, { method: "DELETE" });
export const adminAddChapter = (bookId, data) =>
  request(`/admin/books/${bookId}/chapters`, { method: "POST", body: JSON.stringify(data) });
