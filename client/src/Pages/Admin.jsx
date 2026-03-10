import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../Components/Header";
import * as api from "../api";

export default function Admin() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [msg, setMsg] = useState("");

  const [showBookForm, setShowBookForm] = useState(false);
  const [bookForm, setBookForm] = useState({ title: "", author: "", description: "", coverUrl: "", genre: "", pages: 0, publishedYear: 2024, rating: 0 });
  const [editBookId, setEditBookId] = useState(null);
  const [chapterForm, setChapterForm] = useState({ title: "", content: "" });
  const [showChapterForm, setShowChapterForm] = useState(null);
  const [blacklistReason, setBlacklistReason] = useState("");
  const [showBlacklistModal, setShowBlacklistModal] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("arn_token");
    if (!token) { navigate("/login"); return; }
    loadAdmin();
  }, []);

  async function loadAdmin() {
    try {
      const meRes = await api.getMe();
      if (meRes.user.role !== "admin") { navigate("/dashboard"); return; }
      setUser(meRes.user);
      const [statsRes, usersRes, booksRes] = await Promise.all([api.adminGetStats(), api.adminGetUsers(), api.adminGetBooks()]);
      setStats(statsRes.stats);
      setUsers(usersRes.users);
      setBooks(booksRes.books);
    } catch (e) {
      console.error(e);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId, role) {
    try {
      await api.adminUpdateRole(userId, role);
      setMsg(`Role updated to ${role}`);
      const res = await api.adminGetUsers();
      setUsers(res.users);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function handleDeleteUser(userId, name) {
    if (!confirm(`Delete user "${name}" and all their data? This cannot be undone.`)) return;
    try {
      await api.adminDeleteUser(userId);
      setMsg("User deleted");
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      const statsRes = await api.adminGetStats();
      setStats(statsRes.stats);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function handleBlacklistUser(userId, shouldBlacklist) {
    try {
      await api.adminBlacklistUser(userId, shouldBlacklist, blacklistReason);
      setMsg(shouldBlacklist ? "User has been blacklisted" : "User has been unblacklisted");
      setShowBlacklistModal(null);
      setBlacklistReason("");
      const res = await api.adminGetUsers();
      setUsers(res.users);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function handleSaveBook() {
    try {
      if (editBookId) {
        await api.adminUpdateBook(editBookId, bookForm);
        setMsg("Book updated");
      } else {
        await api.adminCreateBook(bookForm);
        setMsg("Book created");
      }
      setShowBookForm(false);
      setEditBookId(null);
      setBookForm({ title: "", author: "", description: "", coverUrl: "", genre: "", pages: 0, publishedYear: 2024, rating: 0 });
      const res = await api.adminGetBooks();
      setBooks(res.books);
      const statsRes = await api.adminGetStats();
      setStats(statsRes.stats);
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function handleDeleteBook(bookId, title) {
    if (!confirm(`Delete "${title}" and all its chapters?`)) return;
    try {
      await api.adminDeleteBook(bookId);
      setMsg("Book deleted");
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      const statsRes = await api.adminGetStats();
      setStats(statsRes.stats);
    } catch (e) {
      setMsg(e.message);
    }
  }

  function startEditBook(book) {
    setEditBookId(book.id);
    setBookForm({
      title: book.title, author: book.author, description: book.description || "",
      coverUrl: book.cover_url || "", genre: book.genre || "", pages: book.pages || 0,
      publishedYear: book.published_year || 2024, rating: book.rating || 0
    });
    setShowBookForm(true);
  }

  async function handleAddChapter(bookId) {
    try {
      await api.adminAddChapter(bookId, chapterForm);
      setMsg("Chapter added");
      setShowChapterForm(null);
      setChapterForm({ title: "", content: "" });
      const res = await api.adminGetBooks();
      setBooks(res.books);
    } catch (e) {
      setMsg(e.message);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500 flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
          Loading admin panel...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header user={user} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500">Manage your ARN.IO platform</p>
          </div>
          <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-medium">Admin</span>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 text-sm flex items-center justify-between">
            {msg}
            <button onClick={() => setMsg("")} className="text-orange-400 hover:text-orange-600 ml-3">&times;</button>
          </div>
        )}

        <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 overflow-x-auto">
          {[["overview", "Overview"], ["users", "Users"], ["books", "Books"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap px-4 ${tab === key ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-700"}`}
            >{label}</button>
          ))}
        </div>

        {tab === "overview" && stats && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Total Users", value: stats.totalUsers },
                { label: "Total Books", value: stats.totalBooks },
                { label: "Admins", value: stats.totalAdmins },
                { label: "Blacklisted", value: stats.blacklistedUsers || 0, warn: true },
              ].map((s) => (
                <div key={s.label} className={`bg-white border rounded-xl p-4 ${s.warn && s.value > 0 ? "border-red-200" : "border-gray-200"}`}>
                  <p className={`text-2xl font-bold ${s.warn && s.value > 0 ? "text-red-600" : "text-gray-900"}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Users</h3>
                <div className="space-y-2">
                  {stats.recentUsers?.map((u) => (
                    <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}>{u.role}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Popular Books</h3>
                <div className="space-y-2">
                  {stats.popularBooks?.map((b, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{b.title}</p>
                        <p className="text-xs text-gray-500">{b.author}</p>
                      </div>
                      <span className="text-xs text-gray-400">{b.readers} reader{b.readers !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "users" && (
          <div>
            {/* Blacklist Reason Modal */}
            {showBlacklistModal && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Blacklist User</h3>
                  <p className="text-sm text-gray-500 mb-4">This will suspend the user's account and prevent them from accessing the platform.</p>
                  <label className="block text-sm text-gray-600 mb-1">Reason (optional)</label>
                  <textarea
                    value={blacklistReason}
                    onChange={(e) => setBlacklistReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Violation of terms of service..."
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-red-400 resize-none mb-4"
                  />
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => { setShowBlacklistModal(null); setBlacklistReason(""); }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                    <button onClick={() => handleBlacklistUser(showBlacklistModal, true)}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors">Blacklist</button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">User</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Books</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Joined</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((u) => (
                      <tr key={u.id} className={`hover:bg-gray-50 ${u.blacklisted ? "bg-red-50/50" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <img src={u.profile_pic} alt="" className="w-8 h-8 rounded-full" />
                              {u.blacklisted && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" title="Blacklisted" />
                              )}
                            </div>
                            <div>
                              <p className={`font-medium ${u.blacklisted ? "text-red-700" : "text-gray-900"}`}>{u.name}</p>
                              <p className="text-xs text-gray-500 sm:hidden">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                        <td className="px-4 py-3">
                          <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={u.id === user.id}
                            className={`text-xs px-2 py-1 rounded-lg border ${u.role === "admin" ? "bg-orange-50 border-orange-200 text-orange-600" : "bg-gray-50 border-gray-200 text-gray-600"}`}>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {u.blacklisted ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-100 text-red-600 font-medium" title={u.blacklist_reason || ""}>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd"/></svg>
                              Blacklisted
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600 font-medium">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{u.books_reading}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}</td>
                        <td className="px-4 py-3 text-right">
                          {u.id !== user.id && (
                            <div className="flex items-center justify-end gap-2">
                              {u.blacklisted ? (
                                <button onClick={() => handleBlacklistUser(u.id, false)}
                                  className="text-xs px-2.5 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors font-medium">Unblock</button>
                              ) : u.role !== "admin" ? (
                                <button onClick={() => setShowBlacklistModal(u.id)}
                                  className="text-xs px-2.5 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-lg transition-colors font-medium">Blacklist</button>
                              ) : null}
                              <button onClick={() => handleDeleteUser(u.id, u.name)}
                                className="text-xs px-2.5 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "books" && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => { setShowBookForm(true); setEditBookId(null); setBookForm({ title: "", author: "", description: "", coverUrl: "", genre: "", pages: 0, publishedYear: 2024, rating: 0 }); }}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors">
                Add Book
              </button>
            </div>

            {showBookForm && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{editBookId ? "Edit Book" : "New Book"}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Title</label>
                    <input type="text" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Author</label>
                    <input type="text" value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">Description</label>
                    <textarea value={bookForm.description} onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })} rows={3}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Cover URL</label>
                    <input type="text" value={bookForm.coverUrl} onChange={(e) => setBookForm({ ...bookForm, coverUrl: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Genre</label>
                    <input type="text" value={bookForm.genre} onChange={(e) => setBookForm({ ...bookForm, genre: e.target.value })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Pages</label>
                    <input type="number" value={bookForm.pages} onChange={(e) => setBookForm({ ...bookForm, pages: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Year</label>
                    <input type="number" value={bookForm.publishedYear} onChange={(e) => setBookForm({ ...bookForm, publishedYear: parseInt(e.target.value) || 2024 })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Rating (0-5)</label>
                    <input type="number" step="0.1" min="0" max="5" value={bookForm.rating} onChange={(e) => setBookForm({ ...bookForm, rating: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={handleSaveBook} className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors">
                    {editBookId ? "Update" : "Create"}
                  </button>
                  <button onClick={() => { setShowBookForm(false); setEditBookId(null); }} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {books.map((b) => (
                <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-4">
                    {b.cover_url && <img src={b.cover_url} alt="" className="w-12 h-18 rounded-lg object-cover hidden sm:block" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{b.title}</h4>
                          <p className="text-sm text-gray-500">{b.author}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 ml-2">
                          <button onClick={() => { setShowChapterForm(showChapterForm === b.id ? null : b.id); setChapterForm({ title: "", content: "" }); }}
                            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                            + Chapter
                          </button>
                          <button onClick={() => startEditBook(b)} className="text-xs text-orange-500 hover:text-orange-600 px-2 py-1.5">Edit</button>
                          <button onClick={() => handleDeleteBook(b.id, b.title)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5">Delete</button>
                        </div>
                      </div>
                      <div className="flex gap-3 mt-2 text-xs text-gray-400">
                        <span>{b.genre}</span>
                        <span>{b.total_chapters} ch.</span>
                        <span>{b.total_readers} readers</span>
                        <span>{b.pages} pages</span>
                      </div>
                    </div>
                  </div>

                  {showChapterForm === b.id && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <h5 className="text-sm font-medium text-gray-900 mb-3">Add Chapter</h5>
                      <div className="space-y-3">
                        <input type="text" value={chapterForm.title} onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })}
                          placeholder="Chapter title" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400" />
                        <textarea value={chapterForm.content} onChange={(e) => setChapterForm({ ...chapterForm, content: e.target.value })}
                          rows={6} placeholder="Chapter content..." className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-orange-400 resize-none" />
                        <div className="flex gap-2">
                          <button onClick={() => handleAddChapter(b.id)} disabled={!chapterForm.title || !chapterForm.content}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-sm font-medium transition-colors">Add</button>
                          <button onClick={() => setShowChapterForm(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors">Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
