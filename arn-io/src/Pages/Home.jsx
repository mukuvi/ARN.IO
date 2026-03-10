import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../Components/Header";

const features = [
  { title: "10+ Classic Books", desc: "From Blossoms of the Savannah to The Art of War — read directly in your browser." },
  { title: "Smart Reading Assistant", desc: "Ask questions, get summaries, and explore themes with our built-in helper." },
  { title: "Track Progress", desc: "Monitor your reading streaks, bookmarks, and chapter progress across all titles." },
  { title: "Notes & Highlights", desc: "Save your thoughts and key passages while reading. Never lose an insight." },
  { title: "Smart Search", desc: "Find books by title, author, or genre instantly." },
  { title: "Clean Reading UI", desc: "Distraction-free reading experience designed for long sessions." },
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

      <section className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
          <span className="text-sm text-orange-600">10 books available</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Read Smarter with<br />
          <span className="text-orange-500">ARN.IO</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          Your intelligent reading companion. Access a curated library, track your progress,
          take notes, and explore any book — all in one beautiful interface.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate(user ? "/dashboard" : "/login")}
            className="px-8 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105"
          >
            {user ? "Go to Dashboard" : "Get Started Free"}
          </button>
          <a href="#features" className="px-8 py-3.5 border border-gray-300 hover:border-orange-400 rounded-xl font-medium text-gray-700 transition-all">
            Learn More
          </a>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center mb-12">Everything You Need to Read Better</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={f.title} className="p-6 rounded-2xl bg-white border border-gray-200 hover:border-orange-400 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-orange-500 text-white flex items-center justify-center text-sm font-bold mb-4">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-orange-500 transition-colors">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-20 text-center">
        <div className="p-10 rounded-3xl bg-orange-50 border border-orange-200">
          <h2 className="text-2xl font-bold mb-3">Ready to start reading?</h2>
          <p className="text-gray-500 mb-6">Create a free account and dive into our library.</p>
          <Link
            to={user ? "/dashboard" : "/login"}
            className="inline-block px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-all hover:scale-105"
          >
            {user ? "Open Dashboard" : "Sign Up Now"}
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} ARN.IO. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
