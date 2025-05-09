import React from "react";
import { Link } from "react-router-dom";

const heroData = [
  {
    id: 1,
    title: "Plan your reading",
    source: "Schedule",
    firstDescription: "Worried you never stick to reading?",
    secondDescription: "Track your progress efficiently",
  },
  {
    id: 2,
    title: "Access reading",
    source: "Resources",
    firstDescription: "Get access to a vast library of reading resources",
    secondDescription: "From books to PDFs",
  },
  {
    id: 3,
    title: "Upload your own",
    source: "Documents",
    firstDescription: "Want your own document? No worries",
    secondDescription: "Upload yours easily",
  },
];

function Hero({ main }) {
  return (
    <div className="border rounded-2xl p-6 shadow-lg bg-white w-full max-w-2xl mx-auto my-4">
      <h1 className="text-2xl font-bold text-blue-700">{main.title}</h1>
      <div className="mt-2">
        <h2 className="text-lg font-semibold text-gray-600">{main.source}</h2>
        <p className="text-gray-700 mt-1">{main.firstDescription}</p>
        <p className="text-gray-700">{main.secondDescription}</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-blue-100 p-6 flex flex-col items-center">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-800">Welcome to ARN.io</h1>
        <p className="text-lg text-gray-600 mt-2">
          Your smart reading companion
        </p>
      </header>
      <main className="flex flex-col items-center w-full">
        {heroData.map((item) => (
          <Hero key={item.id} main={item} />
        ))}
        <Link to="/login">
          <button className="mt-8 bg-blue-600 text-white px-6 py-3 rounded-full text-lg hover:bg-blue-700 transition duration-300">
            Get Started
          </button>
        </Link>
      </main>
    </div>
  );
}
