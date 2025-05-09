import React from "react";
import App from "../App";
import { Link, NavLink } from "react-router-dom";
// import { logo } from "../images/progress.jpg";

export default function Header() {
  return (
    <>
      <div className="header-section">
        <h3 className="nav-logo">
          <Link className="nav-logo" to="/">
            ARN.IO
          </Link>
        </h3>
        <ul className="header-list">
          <li>
            <NavLink to="/" id="nav-sect">
              Home
            </NavLink>{" "}
          </li>
          <li>
            {" "}
            <NavLink to="/Dashboard" id="nav-sect">
              Workspace
            </NavLink>
          </li>
          <NavLink to="/Authenticate" id="nav-sect" className="hide">
            Get started
          </NavLink>
        </ul>
      </div>
    </>
  );
}
