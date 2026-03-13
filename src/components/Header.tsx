'use client';

import { useTheme } from './ThemeProvider';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function Header() {
  const { toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            {/* Plain <img> so basePath is applied correctly in static export */}
            <img
              src={`${BASE_PATH}/assets/unam-logo-png-transparent.png`}
              alt="UNAM Logo"
              className="university-logo"
            />
            <div className="logo-text">
              <h1>Natural Language Processing with Deep Learning</h1>
              <p className="subtitle">School of Engineering - UNAM · Semester 2026-2</p>
            </div>
          </div>
          <button
            className="theme-toggle"
            id="themeToggle"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
          >
            <span className="sun-icon">☀️</span>
            <span className="moon-icon">🌙</span>
          </button>
        </div>
      </div>
    </header>
  );
}
