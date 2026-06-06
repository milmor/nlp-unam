'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { label: 'Overview', href: '/#overview' },
  { label: 'Syllabus', href: '/#syllabus' },
  { label: 'Prerequisites', href: '/prerequisites' },
  { label: 'Guidelines', href: '/guidelines' },
  { label: 'Instructor', href: '/#instructor' },
  { label: 'Student Experiences', href: '/testimonials' },
  { label: 'Submissions', href: '/submissions' },
];

export default function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  function isActive(href: string) {
    if (href.startsWith('/#')) return pathname === '/';
    return pathname === href;
  }

  return (
    <nav className="nav">
      <div className="container nav-container">
        <button
          type="button"
          className="nav-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="site-nav-menu"
          onClick={() => setMenuOpen(open => !open)}
        >
          <span className="nav-menu-toggle-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="nav-menu-toggle-label">Menu</span>
        </button>
        <ul
          id="site-nav-menu"
          className={`nav-links${menuOpen ? ' nav-links--open' : ''}`}
        >
          {navLinks.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className={isActive(href) ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
