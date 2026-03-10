const API = "http://localhost:3001/api";

function headers() {
  const h = { "Content-Type": "application/json" };
  const token = localStorage.getItem("arn_token");
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, { ...options, headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
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
  const res = await fetch(`${API}/books/${bookId}/file`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("File not available");
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };
}
export const searchBooks = (query) => request(`/books/search/${encodeURIComponent(query)}`);
export const deleteBook = (bookId) => request(`/books/${bookId}`, { method: "DELETE" });
export const searchBooksOnline = (query) => request(`/books/search-online/${encodeURIComponent(query)}`);
export async function uploadDocument({ title, author, genre, content, file }) {
  const token = localStorage.getItem("arn_token");
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

  const res = await fetch(`${API}/books/upload`, { method: "POST", headers: h, body });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
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
