import React from "react";
import { Link } from "react-router-dom";

const loginImageUrl = "../images/login.jpg";

export default function SignUp() {
  return (
    <>
      <div className="signup">
        <img
          src="https://res.cloudinary.com/dicfffpsh/image/upload/v1729703890/login_ifmcrd.jpg"
          id="login-img"
        />
        <p>Signup to use ARN.IO</p>
        <form className="form-section">
          <div className="sign-class">
            <div className="left-sign">
              <input
                type="text"
                placeholder="First Name"
                name="first name"
                className="input"
                id="input-name"
              />
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
            </div>

            <div className="right-sign">
              <input
                type="text"
                placeholder="Last Name"
                name="first name"
                className="input"
                id="input-name"
              />
              <input
                type="tel"
                placeholder="phone number"
                name="phone number"
                className="input"
                id="input-phone"
              />
              <input
                type="password"
                placeholder="confirm password"
                name="password"
                className="input"
                id="input-password"
              />
            </div>
          </div>
          <button id="login-btn">
            <Link to="/Dashboard" className="linked">
              signup
            </Link>
          </button>
        </form>
      </div>
    </>
  );
}
