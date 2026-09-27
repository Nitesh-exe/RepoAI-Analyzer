"use client";

import { LogIn, UserPlus, ExternalLink, Code2 } from "lucide-react";

interface NavbarProps {
  loggedIn: boolean;
  onLogin: () => void;
  onSignup: () => void;
  onLogout: () => void;
}

export default function Navbar({
  loggedIn,
  onLogin,
  onSignup,
  onLogout,
}: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="nav-brand">
        <div className="brand-icon">
          <Code2 size={20} />
        </div>

        <span>RepoAI</span>
      </div>

      <div className="nav-links">
        <a href="#home">Home</a>
        <a href="#about">About</a>

        <a
          href="https://mywebsite-silk-eight.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="creator-link"
        >
          Creator
          <ExternalLink size={14} />
        </a>
      </div>

      <div className="nav-actions">
        {loggedIn ? (
          <button
            className="nav-button logout-button"
            onClick={onLogout}
          >
            Logout
          </button>
        ) : (
          <>
            <button
              className="nav-button login-button"
              onClick={onLogin}
            >
              <LogIn size={16} />
              Login
            </button>

            <button
              className="nav-button signup-button"
              onClick={onSignup}
            >
              <UserPlus size={16} />
              Sign up
            </button>
          </>
        )}
      </div>
    </nav>
  );
}