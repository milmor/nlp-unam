'use client';

import Image from 'next/image';
import { useTheme } from './ThemeProvider';

export default function Header() {
  const { toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <Image
              src="/assets/unam-logo-png-transparent.png"
              alt="UNAM Logo"
              className="university-logo"
              width={120}
              height={70}
              style={{ height: '70px', width: 'auto' }}
              priority
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
