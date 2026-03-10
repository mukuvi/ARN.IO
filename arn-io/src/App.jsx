import "./App.css";
import { Routes, Route } from "react-router-dom";
import Home from "./Pages/Home";
import Authenticate from "./Pages/Authenticate";
import Dashboard from "./Pages/Dashboard";
import NotFound from "./Pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Authenticate />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
