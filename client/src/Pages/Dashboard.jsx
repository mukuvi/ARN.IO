import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import Header from "../Components/Header";
import * as api from "../api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [books, setBooks] = useState([]);
  const [progress, setProgress] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [currentChapter, setCurrentChapter] = useState(null);
  const [tab, setTab] = useState("library");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const [notes, setNotes] = useState([]);
  const [noteInput, setNoteInput] = useState("");

  const [suggestions, setSuggestions] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("arn_token");
    if (!token) { navigate("/login"); return; }
    loadData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function loadData() {
    try {
      const [meRes, booksRes, progRes, statsRes] = await Promise.all([api.getMe(), api.getBooks(), api.getProgress(), api.getStats()]);
      setUser(meRes.user);
      setBooks(booksRes.books);
      setProgress(progRes.progress);
      setStats(statsRes.stats);
      localStorage.setItem("arn_user", JSON.stringify(meRes.user));
    } catch (err) {
      if (err.message === "Invalid token" || err.message === "Token expired" || err.message === "No token provided") {
        localStorage.removeItem("arn_token");
        localStorage.removeItem("arn_user");
        navigate("/login");
      } else {
        console.error("Dashboard load error:", err);
        setUser(JSON.parse(localStorage.getItem("arn_user")));
      }
    } finally {
      setLoading(false);
    }
  }

  async function openBook(book) {
    setSelectedBook(book);
    setTab("reading");
    setSidebarOpen(false);
    setChapterLoading(true);
    try {
      const res = await api.getBook(book.id);
      setChapters(res.chapters || []);
      const prog = progress.find((p) => p.book_id === book.id);
      const chapNum = prog?.current_chapter || 1;
      const chapRes = await api.getChapter(book.id, chapNum);
      setCurrentChapter(chapRes.chapter);
      const [notesRes, chatRes] = await Promise.all([api.getBookNotes(book.id), api.getAiHistory(book.id)]);
      setNotes(notesRes.notes || []);
      setChatMessages(chatRes.chats || []);
    } catch (e) {
      console.error(e);
    } finally {
      setChapterLoading(false);
    }
    try {
      await api.updateProgress(book.id, { currentChapter: 1, progressPercent: 5 });
      const progRes = await api.getProgress();
      setProgress(progRes.progress);
    } catch {}
  }

  async function goToChapter(num) {
    if (!selectedBook) return;
    setChapterLoading(true);
    try {
      const res = await api.getChapter(selectedBook.id, num);
      setCurrentChapter(res.chapter);
      const pct = Math.round((num / (selectedBook.total_chapters || 5)) * 100);
      await api.updateProgress(selectedBook.id, { currentChapter: num, progressPercent: Math.min(pct, 100) });
      const progRes = await api.getProgress();
      setProgress(progRes.progress);
    } catch (e) {
      console.error(e);
    } finally {
      setChapterLoading(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", message: msg }]);
    setChatLoading(true);
    try {
      const res = await api.aiChat(selectedBook?.id, msg);
      setChatMessages((prev) => [...prev, { role: "assistant", message: res.reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", message: "Sorry, something went wrong. Try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function saveNote() {
    if (!noteInput.trim() || !selectedBook) return;
    try {
      await api.createNote(selectedBook.id, currentChapter?.chapter_number, noteInput.trim(), "note");
      setNoteInput("");
      const res = await api.getBookNotes(selectedBook.id);
      setNotes(res.notes || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function removeNote(id) {
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {}
  }

  const filteredBooks = books.filter(
    (b) => b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase()) || b.genre.toLowerCase().includes(search.toLowerCase())
  );

  const myBooks = progress.map((p) => ({ ...p, book: books.find((b) => b.id === p.book_id) })).filter((p) => p.book);

  async function getAiSuggestions() {
    setSuggestLoading(true);
    try {
      const genres = myBooks.map(b => b.book?.genre).filter(Boolean);
      const titles = myBooks.map(b => b.book?.title).filter(Boolean);
      const msg = genres.length > 0
        ? `Based on my reading history (genres: ${[...new Set(genres)].join(", ")}; books: ${titles.slice(0, 3).join(", ")}), suggest 3 new books I should read next. Give title, author, and a one-line reason.`
        : "Suggest 3 great books for a new reader who wants to explore different genres. Give title, author, and a one-line reason.";
      const res = await api.aiChat(null, msg);
      setSuggestions(res.reply);
    } catch {
      setSuggestions("Could not load suggestions right now. Try again later.");
    } finally {
      setSuggestLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500 flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header user={user} />

      <div className="flex h-[calc(100vh-64px)] relative">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:static z-40 w-72 h-[calc(100vh-64px)] bg-gray-50 border-r border-gray-200 flex flex-col transition-transform duration-200`}>
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={user?.profilePic} alt="" className="w-10 h-10 rounded-full" />
                <div>
                  <p className="font-semibold text-sm text-gray-900">{user?.name}</p>
                  <p className="text-xs text-gray-500">{myBooks.length} books in progress</p>
                </div>
              </div>
              <button className="md:hidden text-gray-400 hover:text-gray-600 text-xl" onClick={() => setSidebarOpen(false)}>
                &times;
              </button>
            </div>
          </div>

          <div className="p-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search books..."
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400"
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            {myBooks.length > 0 && (
              <div className="px-3 pb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Reading</p>
                {myBooks.map((p) => (
                  <button
                    key={p.book_id}
                    onClick={() => openBook(p.book)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left text-sm transition-all mb-1 ${
                      selectedBook?.id === p.book_id ? "bg-white border border-gray-300 shadow-sm" : "hover:bg-white"
                    }`}
                  >
                    <img src={p.cover_url} alt="" className="w-8 h-12 rounded object-cover flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{p.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${p.progress_percent}%` }}></div>
                        </div>
                        <span className="text-xs text-gray-400">{p.progress_percent}%</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="px-3 pb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Library</p>
              {filteredBooks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => openBook(b)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg text-left text-sm transition-all mb-1 ${
                    selectedBook?.id === b.id ? "bg-white border border-gray-300 shadow-sm" : "hover:bg-white"
                  }`}
                >
                  <img src={b.cover_url} alt="" className="w-8 h-12 rounded object-cover flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{b.title}</p>
                    <p className="text-xs text-gray-500 truncate">{b.author}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedBook ? (
            <>
              <div className="border-b border-gray-200 bg-white">
                <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
                  <button className="md:hidden text-gray-500 hover:text-orange-500" onClick={() => setSidebarOpen(true)}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">{selectedBook.title}</h2>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">by {selectedBook.author}</p>
                  </div>
                  <div className="text-sm text-gray-500 hidden sm:block">{selectedBook.genre}</div>
                </div>
                <div className="flex px-4 sm:px-6 gap-1 overflow-x-auto">
                  {[
                    ["reading", "Read"],
                    ["chat", "Chat"],
                    ["notes", "Notes"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                        tab === key ? "bg-gray-50 text-orange-500 border-t-2 border-orange-500" : "text-gray-500 hover:text-orange-500"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                {tab === "reading" && (
                  <div className="h-full flex flex-col md:flex-row">
                    <div className="hidden md:block w-52 bg-gray-50 border-r border-gray-200 overflow-y-auto">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide p-3">Chapters</p>
                      {chapters.map((c) => (
                        <button
                          key={c.chapter_number}
                          onClick={() => goToChapter(c.chapter_number)}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            currentChapter?.chapter_number === c.chapter_number
                              ? "bg-white text-orange-500 font-medium border-r-2 border-orange-500"
                              : "text-gray-500 hover:text-orange-500 hover:bg-white"
                          }`}
                        >
                          Ch. {c.chapter_number}: {c.title}
                        </button>
                      ))}
                    </div>

                    <div className="md:hidden flex overflow-x-auto gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200">
                      {chapters.map((c) => (
                        <button
                          key={c.chapter_number}
                          onClick={() => goToChapter(c.chapter_number)}
                          className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors ${
                            currentChapter?.chapter_number === c.chapter_number
                              ? "bg-orange-500 text-white"
                              : "bg-white text-gray-500 border border-gray-200"
                          }`}
                        >
                          Ch. {c.chapter_number}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 overflow-y-auto bg-white">
                      {chapterLoading ? (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                          Loading chapter...
                        </div>
                      ) : currentChapter ? (
                        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
                          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Chapter {currentChapter.chapter_number}: {currentChapter.title}</h3>
                          <div className="h-px bg-gray-200 mb-6 sm:mb-8"></div>
                          <div className="text-gray-700 leading-relaxed text-sm sm:text-[15px] space-y-4 whitespace-pre-line">
                            {currentChapter.content}
                          </div>
                          <div className="flex items-center justify-between mt-8 sm:mt-12 pt-6 border-t border-gray-200">
                            <button
                              onClick={() => goToChapter(currentChapter.chapter_number - 1)}
                              disabled={currentChapter.chapter_number <= 1}
                              className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm disabled:opacity-30 hover:bg-gray-200 transition-colors"
                            >
                              Previous
                            </button>
                            <span className="text-xs sm:text-sm text-gray-400">
                              {currentChapter.chapter_number} of {chapters.length}
                            </span>
                            <button
                              onClick={() => goToChapter(currentChapter.chapter_number + 1)}
                              disabled={currentChapter.chapter_number >= chapters.length}
                              className="px-3 sm:px-4 py-2 rounded-lg bg-orange-500 text-white text-sm disabled:opacity-30 hover:bg-orange-600 transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-400">
                          Select a chapter to start reading
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === "chat" && (
                  <div className="h-full flex flex-col bg-gray-50">
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                      {chatMessages.length === 0 && (
                        <div className="text-center text-gray-400 py-8 sm:py-12">
                          <p className="font-semibold text-gray-600 text-lg mb-2">Reading Assistant</p>
                          <p className="text-sm">Ask me anything about "{selectedBook.title}"</p>
                          <div className="flex flex-wrap justify-center gap-2 mt-4">
                            {["Summarize this book", "What are the main themes?", "Tell me about the characters"].map((q) => (
                              <button
                                key={q}
                                onClick={() => { setChatInput(q); }}
                                className="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-600 transition-colors"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {chatMessages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[90%] sm:max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                            m.role === "user"
                              ? "bg-orange-500 text-white rounded-br-sm"
                              : "bg-white border border-gray-200 text-gray-700 rounded-bl-sm"
                          }`}>
                            <div className="whitespace-pre-line">{m.message}</div>
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-sm">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                              <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="p-3 sm:p-4 border-t border-gray-200 bg-white">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && sendChat()}
                          placeholder="Ask about this book..."
                          className="flex-1 px-3 sm:px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400"
                        />
                        <button
                          onClick={sendChat}
                          disabled={chatLoading || !chatInput.trim()}
                          className="px-4 sm:px-5 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl font-medium text-sm transition-colors"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {tab === "notes" && (
                  <div className="h-full flex flex-col bg-gray-50">
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                      {notes.length === 0 ? (
                        <div className="text-center text-gray-400 py-8 sm:py-12">
                          <p className="font-semibold text-gray-600 text-lg mb-2">No notes yet</p>
                          <p className="text-sm">Start taking notes while reading "{selectedBook.title}"</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-w-2xl mx-auto">
                          {notes.map((n) => (
                            <div key={n.id} className="bg-white border border-gray-200 rounded-xl p-4 group">
                              <div className="flex items-start justify-between">
                                <div>
                                  {n.chapter_number && (
                                    <span className="text-xs text-gray-500 font-medium">Chapter {n.chapter_number}</span>
                                  )}
                                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{n.content}</p>
                                </div>
                                <button
                                  onClick={() => removeNote(n.id)}
                                  className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all text-lg ml-2"
                                >
                                  x
                                </button>
                              </div>
                              <p className="text-xs text-gray-400 mt-2">{new Date(n.created_at).toLocaleDateString()}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-3 sm:p-4 border-t border-gray-200 bg-white">
                      <div className="flex gap-2 max-w-2xl mx-auto">
                        <input
                          type="text"
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveNote()}
                          placeholder={`Add a note${currentChapter ? ` for Chapter ${currentChapter.chapter_number}` : ""}...`}
                          className="flex-1 px-3 sm:px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400"
                        />
                        <button
                          onClick={saveNote}
                          disabled={!noteInput.trim()}
                          className="px-4 sm:px-5 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl font-medium text-sm transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <button className="text-gray-500 hover:text-orange-500 md:hidden" onClick={() => setSidebarOpen(true)}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900">Welcome back, {user?.name?.split(" ")[0]}</h2>
                      <p className="text-sm text-gray-500">Here is your reading overview</p>
                    </div>
                  </div>
                  <Link to="/profile" className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:border-orange-400 transition-colors">
                    <img src={user?.profilePic} alt="" className="w-6 h-6 rounded-full" />
                    <span className="text-xs text-gray-600 hidden sm:inline">Profile</span>
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-2xl font-bold text-gray-900">{stats?.booksInProgress || myBooks.length}</p>
                    <p className="text-xs text-gray-500 mt-1">Reading</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-2xl font-bold text-gray-900">{stats?.completedBooks || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Completed</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-2xl font-bold text-orange-500">{stats?.maxStreak || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Best Streak</p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-2xl font-bold text-gray-900">{stats?.totalNotes || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Notes</p>
                  </div>
                </div>

                {stats && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="text-xs font-medium text-gray-500 mb-2">Average Progress</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full">
                          <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${stats.avgProgress}%` }}></div>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{stats.avgProgress}%</span>
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">Favorite Genre</p>
                      <p className="text-lg font-bold text-gray-900">{stats.favoriteGenre}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">Total Streak Days</p>
                      <p className="text-lg font-bold text-gray-900">{stats.totalStreak}</p>
                    </div>
                  </div>
                )}

                {myBooks.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Continue Reading</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {myBooks.slice(0, 3).map((p) => (
                        <button
                          key={p.book_id}
                          onClick={() => openBook(p.book)}
                          className="flex gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-orange-400 transition-all text-left"
                        >
                          <img src={p.cover_url} alt="" className="w-14 h-20 rounded-lg object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-gray-900 truncate">{p.title}</p>
                            <p className="text-xs text-gray-500">{p.author}</p>
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Ch. {p.current_chapter}</span>
                                <span>{p.progress_percent}%</span>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full">
                                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${p.progress_percent}%` }}></div>
                              </div>
                            </div>
                            {p.streak_days > 0 && (
                              <p className="text-xs text-orange-500 mt-1 font-medium">{p.streak_days} day streak</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-900">Reading Suggestions</h3>
                    <button onClick={getAiSuggestions} disabled={suggestLoading}
                      className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg text-xs font-medium transition-colors">
                      {suggestLoading ? "Thinking..." : suggestions ? "Refresh" : "Get Suggestions"}
                    </button>
                  </div>
                  {suggestions ? (
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{suggestions}</div>
                  ) : (
                    <p className="text-sm text-gray-400">Click the button to get personalized book suggestions based on your reading history</p>
                  )}
                </div>

                {stats?.recentActivity?.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
                    <h3 className="text-base font-semibold text-gray-900 mb-3">Recent Activity</h3>
                    <div className="space-y-2">
                      {stats.recentActivity.map((a, i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-700">{a.title}</span>
                          <span className="text-xs text-gray-400">{a.last_read ? new Date(a.last_read).toLocaleDateString() : ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <h3 className="text-base font-semibold text-gray-900 mb-3">Browse Library</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filteredBooks.map((b) => (
                    <button key={b.id} onClick={() => openBook(b)} className="group text-left">
                      <div className="aspect-[2/3] rounded-xl overflow-hidden mb-2 border border-gray-200 group-hover:border-orange-400 transition-all">
                        <img src={b.cover_url} alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <p className="font-medium text-xs sm:text-sm text-gray-900 truncate group-hover:text-orange-500 transition-colors">{b.title}</p>
                      <p className="text-xs text-gray-500 truncate">{b.author}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
