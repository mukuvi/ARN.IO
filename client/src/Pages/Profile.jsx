import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../Components/Header";
import * as api from "../api";

const AI_PRESETS = {
  groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
  deepseek: { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  gemini: { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
  mistral: { label: "Mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
  custom: { label: "Custom OpenAI compatible", baseUrl: "", model: "" },
};

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPic, setEditPic] = useState("");
  const [picFile, setPicFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const [deletePw, setDeletePw] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [aiSettings, setAiSettings] = useState(null);
  const [aiProvider, setAiProvider] = useState("groq");
  const [aiModel, setAiModel] = useState(AI_PRESETS.groq.model);
  const [aiBaseUrl, setAiBaseUrl] = useState(AI_PRESETS.groq.baseUrl);
  const [aiKey, setAiKey] = useState("");
  const [aiMsg, setAiMsg] = useState("");
  const [aiSaving, setAiSaving] = useState(false);

  const [tab, setTab] = useState("profile");

  useEffect(() => {
    const token = localStorage.getItem("arn_token");
    if (!token) { navigate("/login"); return; }
    loadProfile();
    loadAiSettings();
  }, []);

  async function loadProfile() {
    try {
      const [meRes, statsRes] = await Promise.all([api.getMe(), api.getStats()]);
      setUser(meRes.user);
      setStats(statsRes.stats);
      setEditName(meRes.user.name);
      setEditBio(meRes.user.bio || "");
      setEditPic(meRes.user.profilePic || "");
    } catch {
      setUser(JSON.parse(localStorage.getItem("arn_user")));
    } finally {
      setLoading(false);
    }
  }

  async function loadAiSettings() {
    try {
      const res = await api.getAiSettings();
      if (res.settings) {
        setAiSettings(res.settings);
        setAiProvider(res.settings.provider);
        setAiModel(res.settings.model);
        setAiBaseUrl(res.settings.baseUrl);
      }
    } catch {
      setAiSettings(null);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setMsg("");
    try {
      let picToSave = editPic;
      if (picFile) {
        picToSave = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(picFile);
        });
      }
      const res = await api.updateProfile({ name: editName, bio: editBio, profilePic: picToSave });
      setUser(res.user);
      localStorage.setItem("arn_user", JSON.stringify(res.user));
      if (res.token) localStorage.setItem("arn_token", res.token);
      setMsg("Profile updated");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handlePicFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMsg("Image must be under 2MB"); return; }
    setPicFile(file);
    const url = URL.createObjectURL(file);
    setEditPic(url);
  }

  function logout() {
    localStorage.removeItem("arn_token");
    localStorage.removeItem("arn_user");
    navigate("/");
  }

  async function handleChangePassword() {
    setPwSaving(true);
    setPwMsg("");
    try {
      await api.changePassword(currentPw, newPw);
      setPwMsg("Password changed");
      setCurrentPw("");
      setNewPw("");
    } catch (e) {
      setPwMsg(e.message);
    } finally {
      setPwSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await api.deleteAccount(deletePw);
      localStorage.removeItem("arn_token");
      localStorage.removeItem("arn_user");
      navigate("/");
    } catch (e) {
      setMsg(e.message);
      setDeleting(false);
    }
  }

  function handleAiProviderChange(value) {
    setAiProvider(value);
    const preset = AI_PRESETS[value];
    if (preset) {
      setAiModel(preset.model);
      setAiBaseUrl(preset.baseUrl);
    }
  }

  async function saveAiSettings() {
    setAiSaving(true);
    setAiMsg("");
    try {
      const res = await api.saveAiSettings({
        provider: aiProvider,
        model: aiModel,
        baseUrl: aiBaseUrl,
        apiKey: aiKey,
      });
      setAiSettings(res.settings);
      setAiKey("");
      setAiMsg(res.message || "AI settings saved");
    } catch (e) {
      setAiMsg(e.message);
    } finally {
      setAiSaving(false);
    }
  }

  async function removeAiSettings() {
    setAiSaving(true);
    setAiMsg("");
    try {
      await api.deleteAiSettings();
      setAiSettings(null);
      setAiKey("");
      setAiMsg("AI settings removed");
    } catch (e) {
      setAiMsg(e.message);
    } finally {
      setAiSaving(false);
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header user={user} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-orange-500 to-orange-400 h-28 sm:h-36 relative">
            <img src={user?.profilePic} alt="" className="absolute -bottom-10 sm:-bottom-14 left-6 w-20 h-20 sm:w-28 sm:h-28 rounded-full border-4 border-white shadow-lg object-cover" />
          </div>
          <div className="pt-14 sm:pt-18 px-6 pb-6">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{user?.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
            {user?.bio && <p className="text-sm text-gray-600 mt-2">{user.bio}</p>}
            <p className="text-xs text-gray-400 mt-2">
              Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "recently"}
              {user?.role === "admin" && <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs font-medium">Admin</span>}
            </p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Books Reading", value: stats.booksInProgress },
              { label: "Completed", value: stats.completedBooks },
              { label: "Total Notes", value: stats.totalNotes },
              { label: "Max Streak", value: `${stats.maxStreak} days` },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {stats && (
          <div className="mb-6">
          </div>
        )}

        {stats?.recentActivity?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Activity</h3>
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

        <div className="flex gap-1 mb-4 bg-white border border-gray-200 rounded-xl p-1">
          {[["profile", "Edit Profile"], ["ai", "AI"], ["password", "Password"], ["danger", "Account"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === key ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-700"}`}
            >{label}</button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Profile</h3>
            {msg && <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${msg.includes("updated") ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>{msg}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Bio</label>
                <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 resize-none"
                  placeholder="Tell us about yourself..." />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Profile Picture</label>
                <div className="flex items-center gap-4">
                  <img src={picFile ? editPic : (editPic || user?.profilePic)} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" />
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium cursor-pointer transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Upload Photo
                      <input type="file" accept="image/*" onChange={handlePicFile} className="hidden" />
                    </label>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG under 2MB</p>
                  </div>
                </div>
              </div>
              <button onClick={saveProfile} disabled={saving}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl font-medium text-sm transition-colors">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {tab === "ai" && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Assistant</h3>
            <p className="text-sm text-gray-500 mb-4">
              Add your own API key from any OpenAI compatible provider. Without a key, the built-in assistant answers basic questions.
            </p>
            {aiMsg && <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${aiMsg.includes("saved") || aiMsg.includes("removed") ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>{aiMsg}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Provider</label>
                <select value={aiProvider} onChange={(e) => handleAiProviderChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400">
                  {Object.entries(AI_PRESETS).map(([key, preset]) => (
                    <option key={key} value={key}>{preset.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Model</label>
                <input type="text" value={aiModel} onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                  placeholder="Model name" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">API base URL</label>
                <input type="text" value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)} disabled={aiProvider !== "custom"}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 disabled:text-gray-400"
                  placeholder="https://api.example.com/v1" />
                <p className="text-xs text-gray-400 mt-1">{aiProvider === "custom" ? "Use an OpenAI compatible endpoint." : "Set automatically for the selected provider."}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">API key</label>
                <input type="password" value={aiKey} onChange={(e) => setAiKey(e.target.value)} autoComplete="off"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                  placeholder={aiSettings?.hasKey ? "Leave blank to keep the saved key" : "Paste your API key"} />
                <p className="text-xs text-gray-400 mt-1">Stored encrypted. The key is never returned to the browser.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={saveAiSettings} disabled={aiSaving || (!aiKey && !aiSettings?.hasKey)}
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl font-medium text-sm transition-colors">
                  {aiSaving ? "Saving..." : "Save AI Settings"}
                </button>
                {aiSettings?.hasKey && (
                  <button onClick={removeAiSettings} disabled={aiSaving}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors">
                    Remove Key
                  </button>
                )}
              </div>
              {aiSettings?.hasKey && (
                <p className="text-sm text-green-600">
                  A key is saved for {AI_PRESETS[aiSettings.provider]?.label || aiSettings.provider}. The assistant uses it first.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "password" && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h3>
            {pwMsg && <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${pwMsg.includes("changed") ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>{pwMsg}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Current Password</label>
                <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">New Password</label>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                  placeholder="Min. 6 characters" />
              </div>
              <button onClick={handleChangePassword} disabled={pwSaving || !currentPw || !newPw}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl font-medium text-sm transition-colors">
                {pwSaving ? "Changing..." : "Change Password"}
              </button>
            </div>
          </div>
        )}

        {tab === "danger" && (
          <div className="bg-white border border-red-200 rounded-xl p-4 sm:p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign Out</h3>
              <p className="text-sm text-gray-500 mb-3">Log out of your ARN.IO account on this device.</p>
              <button onClick={logout} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors">
                Logout
              </button>
            </div>
            <div className="border-t border-red-200 pt-6">
              <h3 className="text-lg font-semibold text-red-600 mb-2">Delete Account</h3>
              <p className="text-sm text-gray-500 mb-4">This will permanently delete your account, all your reading progress, notes, and chat history. This cannot be undone.</p>
              {!deleteConfirm ? (
                <button onClick={() => setDeleteConfirm(true)} className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium text-sm transition-colors">
                  Delete My Account
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-red-600 font-medium">Enter your password to confirm deletion:</p>
                  <input type="password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)}
                    className="w-full px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-gray-900 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
                    placeholder="Your password" />
                  <div className="flex gap-3">
                    <button onClick={handleDeleteAccount} disabled={deleting || !deletePw}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl font-medium text-sm transition-colors">
                      {deleting ? "Deleting..." : "Confirm Delete"}
                    </button>
                    <button onClick={() => { setDeleteConfirm(false); setDeletePw(""); }}
                      className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
