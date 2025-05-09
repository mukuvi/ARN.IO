import { Route, Routes } from "react-router-dom";
import "./App.css";
import Header from "./Components/Header";
import Dashboard from "./Pages/Dashboard";
import Home from "./Pages/Home";
import Authenticate from "./Pages/Authenticate";
import { NotFound } from "./Pages/NotFound";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Authenticate />} />
        <Route path="*" element={<NotFound />} />
        <Route path="/Dashboard" element={<Dashboard />} />
      </Routes>
    </>
  );
}

export default App;
