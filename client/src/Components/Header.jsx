import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

export default function Header({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  function logout() {
    localStorage.removeItem("arn_token");
    localStorage.removeItem("arn_user");
    navigate("/");
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-50">
      <Link to="/" className="text-xl font-bold text-orange-500 tracking-tight">
        ARN.IO
      </Link>

      <nav className="hidden sm:flex items-center gap-5">
        <Link
          to="/"
          className={`text-sm font-medium transition-colors ${location.pathname === "/" ? "text-orange-500" : "text-gray-500 hover:text-orange-500"}`}
        >
          Home
        </Link>

        {user ? (
          <>
            <Link
              to="/dashboard"
              className={`text-sm font-medium transition-colors ${location.pathname === "/dashboard" ? "text-orange-500" : "text-gray-500 hover:text-orange-500"}`}
            >
              Dashboard
            </Link>
            <div className="flex items-center gap-3 ml-2 pl-4 border-l border-gray-200">
              <img src={user.profilePic} alt="" className="w-8 h-8 rounded-full" />
              <span className="text-sm text-gray-700 hidden md:inline">{user.name}</span>
              <button onClick={logout} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                Logout
              </button>
            </div>
          </>
        ) : (
          <Link
            to="/login"
            className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Sign In
          </Link>
        )}
      </nav>

      <button className="sm:hidden text-gray-500 hover:text-orange-500" onClick={() => setMenuOpen(!menuOpen)}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {menuOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          }
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg sm:hidden z-50">
          <div className="flex flex-col p-4 gap-3">
            <Link to="/" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-gray-700 hover:text-orange-500">Home</Link>
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-gray-700 hover:text-orange-500">Dashboard</Link>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                  <img src={user.profilePic} alt="" className="w-8 h-8 rounded-full" />
                  <span className="text-sm text-gray-700">{user.name}</span>
                  <button onClick={() => { logout(); setMenuOpen(false); }} className="ml-auto text-xs text-red-500">Logout</button>
                </div>
              </>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium text-center">Sign In</Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
