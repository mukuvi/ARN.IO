import React from "react";

export default function Hero(props) {
  return (
    <>
      <div className="hero-section">
        <div className="hero-pages">
          <hr />
          <div className="hero-single">
            <h1>{props.main.title}</h1>
            <div className="inner-page">
              <h2>{props.main.source}</h2>
              <p>{props.main.firstDescription}</p>
              <p>{props.main.secondDescription} </p>
            </div>
          </div>
          <hr />
        </div>
      </div>
    </>
  );
}
