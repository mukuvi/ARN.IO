import React from "react";
import { Link } from "react-router-dom";

export default function Authenticate() {
  return (
    <>
      <div className="authenticate">
        <img
          src="https://res.cloudinary.com/dicfffpsh/image/upload/v1729703890/login_ifmcrd.jpg"
          id="login-img"
        />
        <form className="form-section">
          <input
            type="email"
            placeholder="Gmail account"
            name="email"
            className="input"
            id="input-email"
          />
          <input
            type="password"
            placeholder="password"
            name="password"
            className="input"
            id="input-password"
          />

          <button id="login-btn">
            <Link to="/Dashboard" className="linked">
              login
            </Link>
          </button>

          <div className="lower-input">
            <p>Don't have an account?</p>
            <p>
              <Link to="/SignUp" className="signup-con">
                signup
              </Link>
            </p>
          </div>
        </form>
      </div>
    </>
  );
}
