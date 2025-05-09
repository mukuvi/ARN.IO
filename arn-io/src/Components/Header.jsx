import React, { useState } from "react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex justify-between items-center text-2xl px-8 py-4 shadow-md w-full z-[999] bg-white relative">
      <h3>
        <a href="/" className="text-black no-underline hover:opacity-80">
          ARN.IO
        </a>
      </h3>

      <button
        className="md:hidden text-black text-3xl focus:outline-none"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle Menu"
      >
        ☰
      </button>

      <ul className="hidden md:flex list-none py-4 items-center gap-6">
        <li>
          <a
            href="/"
            className="text-black no-underline px-6 py-2 rounded-full hover:bg-blue-100 hover:text-blue-900"
          >
            Home
          </a>
        </li>
        <li>
          <a
            href="/Dashboard"
            className="text-black no-underline px-6 py-2 rounded-full hover:bg-blue-100 hover:text-blue-900"
          >
            Workspace
          </a>
        </li>
        <li className="hidden md:block">
          <a
            href="/Authenticate"
            className="text-black no-underline hover:underline"
          >
            Get started
          </a>
        </li>
      </ul>

      {menuOpen && (
        <ul className="md:hidden absolute top-full left-0 w-full bg-white shadow-md py-4 px-8 flex flex-col gap-4 z-50">
          <li>
            <a
              href="/"
              className="text-black no-underline py-2 block hover:bg-blue-100 hover:text-blue-900 rounded"
            >
              Home
            </a>
          </li>
          <li>
            <a
              href="/Dashboard"
              className="text-black no-underline py-2 block hover:bg-blue-100 hover:text-blue-900 rounded"
            >
              Workspace
            </a>
          </li>
          <li>
            <a
              href="/Authenticate"
              className="text-black no-underline py-2 block hover:underline"
            >
              Get started
            </a>
          </li>
        </ul>
      )}
    </header>
  );
}
