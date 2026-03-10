import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../Components/Header";

const features = [
  { title: "Upload & Read Books", desc: "Upload PDFs, DOCX, or text files and read them chapter-by-chapter in a clean, distraction-free interface." },
  { title: "AI Reading Assistant", desc: "Chat with an AI powered by Gemini that actually reads your books and gives real answers, summaries, and recommendations." },
  { title: "Track Your Progress", desc: "Monitor your reading streaks, chapter progress, and completion stats across all your uploaded books." },
  { title: "Notes & Highlights", desc: "Save your thoughts and key passages while reading. Never lose an insight." },
  { title: "Smart Search", desc: "Search your uploaded books and discover new ones from Google Books — all in one place." },
  { title: "Real Reading Stats", desc: "See chapters read, reading days, favorite genres, and your daily streak — all based on your real activity." },
];

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("arn_token");
    const u = localStorage.getItem("arn_user");
    if (token && u) setUser(JSON.parse(u));
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Header user={user} />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-16 text-center">
        <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 leading-tight">
          Read Smarter with<br />
          <span className="text-orange-500">ARN.IO</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-8 sm:mb-10 px-2">
          Upload your books, read them in a clean interface, chat with an AI that actually understands your content,
          track your progress, and discover new reads — all in one place.
        </p>
        <button
          onClick={() => navigate(user ? "/dashboard" : "/login")}
          className="px-6 sm:px-8 py-3 sm:py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-base sm:text-lg transition-all hover:scale-105"
        >
          {user ? "Go to Dashboard" : "Get Started Free"}
        </button>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Everything You Need to Read Better</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f, i) => (
            <div key={f.title} className="p-5 sm:p-6 rounded-2xl bg-white border border-gray-200 hover:border-orange-400 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-orange-500 text-white flex items-center justify-center text-sm font-bold mb-4">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="text-base sm:text-lg font-semibold mb-2 group-hover:text-orange-500 transition-colors">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} ARN.IO. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
