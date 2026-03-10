import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center text-gray-900">
      <div className="text-center">
        <h1 className="text-8xl font-bold text-orange-500 mb-4">404</h1>
        <p className="text-xl text-gray-500 mb-8">Page not found</p>
        <Link to="/" className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-all">
          Go Home
        </Link>
      </div>
    </div>
  );
}
