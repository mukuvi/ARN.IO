import React from "react";

export default function ProfileRead(read) {
  return (
    <>
      <div className="profile-read">
        <img src={`src/assets/images/${read.img}`} />
        <h2>{read.text}</h2>
      </div>
    </>
  );
}
