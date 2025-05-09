import React from "react";

export default function ProfileRead({ img, text }) {
  return (
    <>
      <div className="profile-read">
        <img src={img} alt={text} />
        <h2>{text}</h2>
      </div>
    </>
  );
}
