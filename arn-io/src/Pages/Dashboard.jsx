import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import profileData from "../Components/profileData";
import Header from "../Components/Header";
import ProfileRead from "../Components/ProfileRead";

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("current");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("userData"));
    if (!storedUser?.isAuthenticated) {
      navigate("/login");
    } else {
      setUserData(storedUser);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("userData");
    navigate("/login");
  };

  const handlePageChange = (direction) => {
    setCurrentPage((prev) =>
      direction === "next" ? prev + 1 : Math.max(1, prev - 1)
    );
  };

  const handleUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const profileDataset = profileData.map((menu, index) => (
    <ProfileRead
      key={index}
      img={menu.img}
      text={menu.text}
      className="profilewrap hover:scale-105 transition-transform duration-200"
    />
  ));

  if (!userData) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading...
      </div>
    );
  }

  return (
    <>
      <div className="header-get">
        <Header onLogout={handleLogout} />
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-stretch p-4 gap-6 min-h-screen">
        <div className="flex flex-col gap-4 w-full lg:w-[300px]">
          <h2 className="text-3xl font-semibold text-gray-800">
            Happy reading {userData.name}
          </h2>
          <div className="bg-blue-100 rounded-3xl p-4 flex flex-col shadow-lg">
            <div className="flex flex-col sm:flex-row justify-around bg-gradient-to-r from-blue-400 to-blue-600 m-4 p-4 rounded-3xl gap-4 text-white">
              <div className="flex flex-col items-center">
                <img
                  src={userData.profilePic}
                  className="w-[90px] h-[90px] rounded-full border-4 border-white"
                  alt="User profile"
                />
                <p className="mt-2 font-medium">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-xl font-bold">{userData.name}</h2>
                <input
                  type="text"
                  name="book"
                  placeholder="Hardy Boys"
                  className="p-2 rounded-full w-full my-2 text-center bg-black bg-opacity-30 outline-none placeholder-white"
                />
                <button className="bg-white text-blue-600 px-4 py-1 rounded-full text-sm font-semibold hover:bg-blue-50 transition-colors">
                  Continue reading
                </button>
              </div>
            </div>
            <div>
              <div className="tabs flex justify-around mb-4">
                <button
                  className={`px-4 py-2 rounded-full ${
                    activeTab === "current"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                  onClick={() => setActiveTab("current")}
                >
                  Current
                </button>
                <button
                  className={`px-4 py-2 rounded-full ${
                    activeTab === "library"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                  onClick={() => setActiveTab("library")}
                >
                  Library
                </button>
              </div>
              <div className="bg-white p-4 rounded-xl grid grid-cols-2 gap-3">
                {profileDataset}
              </div>
              <button
                className="flex items-center justify-center mt-4 p-3 text-lg rounded-xl bg-blue-600 text-white w-full hover:bg-blue-700 transition-colors"
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <div className="w-6 h-6 border-4 border-blue-300 border-t-white rounded-full animate-spin mr-2"></div>
                    Uploading {uploadProgress}%
                  </>
                ) : (
                  <>
                    <img
                      src="https://res.cloudinary.com/dicfffpsh/image/upload/v1729704805/ARN/progress_rrjr4t.png"
                      className="w-5 h-5 rounded-full mr-2"
                      alt="Upload icon"
                    />
                    Upload files
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Center Panel - Reading Content */}
        <div className="flex flex-col items-center w-full lg:w-[600px] flex-1">
          <div className="relative w-full max-w-2xl mb-4">
            <input
              type="text"
              className="p-3 pl-10 rounded-full w-full bg-white shadow-md outline-none focus:ring-2 focus:ring-blue-500"
              name="search"
              placeholder="Search book..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <svg
              className="absolute left-3 top-3.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
          </div>

          <div className="bg-white shadow-lg h-[70vh] w-full rounded-3xl p-6 flex flex-col justify-between leading-8 overflow-auto">
            <div className="text-2xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-3xl text-gray-800">CHAPTER 2</h2>
                <div className="flex space-x-2">
                  <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </button>
                  <button className="p-2 rounded-full bg-gray-100 hover:bg-gray-200">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <p className="text-base mt-2 text-gray-700 leading-relaxed">
                "Blossoms of the Savannah" is a novel by Kenyan author Henry Ole
                Kulet. It is a poignant story that explores the themes of female
                circumcision, early marriage, and the struggle for education and
                empowerment among the Maasai people in Kenya. The story follows
                the lives of two sisters, Taiyo and Resian, who are determined
                to pursue education despite cultural obstacles.
              </p>
              <p className="text-base mt-4 text-gray-700 leading-relaxed">
                As the sisters navigate the challenges of their society, they
                encounter both support and resistance from their community. The
                novel beautifully captures the tension between tradition and
                modernity, and the personal costs of challenging deeply rooted
                cultural practices.
              </p>
            </div>

            <div className="flex justify-between items-center mt-6 border-t pt-4">
              <button
                className="flex items-center text-blue-600 hover:text-blue-800 cursor-pointer"
                onClick={() => handlePageChange("prev")}
              >
                <svg
                  className="w-5 h-5 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Previous
              </button>
              <div className="flex items-center">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  Page {currentPage}
                </span>
              </div>
              <button
                className="flex items-center text-blue-600 hover:text-blue-800 cursor-pointer"
                onClick={() => handlePageChange("next")}
              >
                Next
                <svg
                  className="w-5 h-5 ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Book Details */}
        <div className="w-full lg:w-[300px]">
          <h2 className="text-3xl font-semibold mb-4 text-gray-800">
            Hardy Boys
          </h2>
          <div className="bg-white rounded-3xl p-6 shadow-lg flex flex-col items-center h-full">
            <div className="relative w-full mb-4">
              <img
                src="https://res.cloudinary.com/dicfffpsh/image/upload/v1729704806/ARN/book_qcojey.jpg"
                className="w-full h-[40vh] rounded-2xl object-cover hover:scale-105 transition-transform duration-300 shadow-md"
                alt="Book cover"
              />
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded-full text-xs">
                📖 Mystery
              </div>
            </div>

            <p className="text-lg mt-4 text-gray-700 text-left w-full">
              A mystery book about two brothers and their friends as they try to
              investigate strange happenings on skull mountain.
            </p>

            <div className="w-full mt-6 space-y-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <img
                    src="https://res.cloudinary.com/dicfffpsh/image/upload/v1729704805/ARN/progress_rrjr4t.png"
                    className="w-12 h-12"
                    alt="Progress icon"
                  />
                </div>
                <div className="ml-3 flex-1">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Progress</span>
                    <span>65%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: "65%" }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <img
                    src="https://res.cloudinary.com/dicfffpsh/image/upload/v1729704804/ARN/streak_kejq7i.jpg"
                    className="w-12 h-12"
                    alt="Streak icon"
                  />
                </div>
                <div className="ml-3">
                  <div className="text-sm text-gray-600">Streak</div>
                  <div className="font-semibold">5 Days</div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-medium text-gray-800 mb-2">Book Details</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">Author:</div>
                  <div>Franklin W. Dixon</div>
                  <div className="text-gray-600">Pages:</div>
                  <div>256</div>
                  <div className="text-gray-600">Published:</div>
                  <div>1927</div>
                  <div className="text-gray-600">Rating:</div>
                  <div className="flex items-center">⭐⭐⭐⭐☆</div>
                </div>
              </div>

              <button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
