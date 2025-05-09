import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const userData = JSON.parse(localStorage.getItem("userData"));

  const handleLogout = () => {
    localStorage.removeItem("userData");
    navigate("/login");
    setMenuOpen(false);
  };

  return (
    <header className="flex justify-between items-center text-2xl px-8 py-4 shadow-md w-full z-[999] bg-white relative">
      <h3>
        <Link
          to="/"
          className="text-black no-underline hover:opacity-80 flex items-center gap-2"
        >
          <svg
            className="w-8 h-8 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <span>ARN.IO</span>
        </Link>
      </h3>

      <button
        className="md:hidden text-black text-3xl focus:outline-none"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle Menu"
      >
        {menuOpen ? "✕" : "☰"}
      </button>

      <ul className="hidden md:flex list-none py-4 items-center gap-6">
        <li>
          <Link
            to="/"
            className="text-black no-underline px-6 py-2 rounded-full hover:bg-blue-100 hover:text-blue-900 transition-colors"
          >
            Home
          </Link>
        </li>
        <li>
          <Link
            to="/dashboard"
            className="text-black no-underline px-6 py-2 rounded-full hover:bg-blue-100 hover:text-blue-900 transition-colors"
          >
            Workspace
          </Link>
        </li>
        {userData ? (
          <>
            <li className="flex items-center gap-2">
              <img
                src={userData.profilePic}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="text-sm font-medium">{userData.name}</span>
            </li>
            <li>
              <button
                onClick={handleLogout}
                className="text-black no-underline px-6 py-2 rounded-full hover:bg-blue-100 hover:text-blue-900 transition-colors"
              >
                Logout
              </button>
            </li>
          </>
        ) : (
          <li>
            <Link
              to="/login"
              className="text-black no-underline px-6 py-2 rounded-full bg-blue-100 hover:bg-blue-200 transition-colors"
            >
              Get started
            </Link>
          </li>
        )}
      </ul>

      {menuOpen && (
        <ul className="md:hidden absolute top-full left-0 w-full bg-white shadow-md py-4 px-8 flex flex-col gap-4 z-50">
          <li>
            <Link
              to="/"
              className="text-black no-underline py-2 block hover:bg-blue-100 hover:text-blue-900 rounded transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/dashboard"
              className="text-black no-underline py-2 block hover:bg-blue-100 hover:text-blue-900 rounded transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              Workspace
            </Link>
          </li>
          {userData ? (
            <>
              <li className="flex items-center gap-3 py-2 border-t border-gray-100 pt-4">
                <img
                  src={userData.profilePic}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span className="text-sm font-medium">{userData.name}</span>
              </li>
              <li>
                <button
                  onClick={handleLogout}
                  className="w-full text-left text-black no-underline py-2 block hover:bg-blue-100 hover:text-blue-900 rounded transition-colors"
                >
                  Logout
                </button>
              </li>
            </>
          ) : (
            <li>
              <Link
                to="/login"
                className="text-black no-underline py-2 block hover:bg-blue-100 hover:text-blue-900 rounded transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                Get started
              </Link>
            </li>
          )}
        </ul>
      )}
    </header>
  );
}
