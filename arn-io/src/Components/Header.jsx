import { Link, useNavigate, useLocation } from "react-router-dom";

export default function Header({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  function logout() {
    localStorage.removeItem("arn_token");
    localStorage.removeItem("arn_user");
    navigate("/");
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-50">
      <Link to="/" className="text-xl font-bold text-orange-500 tracking-tight">
        ARN.IO
      </Link>

      <nav className="flex items-center gap-5">
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
              <span className="text-sm text-gray-700 hidden sm:inline">{user.name}</span>
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
    </header>
  );
}
