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

function scrollToHash(hash: string, behavior: ScrollBehavior = 'smooth') {
  const id = hash.replace(/^#/, '');
  if (!id) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior, block: 'start' });
  return true;
}

export default function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // After landing on home with a hash (from another page or refresh), scroll to the section.
  useEffect(() => {
    if (pathname !== '/') return;
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (!hash) return;

    // Wait a tick so the home page content is in the DOM.
    const t1 = window.setTimeout(() => scrollToHash(hash, 'smooth'), 0);
    const t2 = window.setTimeout(() => scrollToHash(hash, 'smooth'), 120);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
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

  function handleHashClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (!href.includes('#')) return;

    const hash = href.slice(href.indexOf('#'));
    // Already on the home page: Next.js Link won't re-scroll to the same-page hash.
    if (pathname === '/') {
      e.preventDefault();
      scrollToHash(hash, 'smooth');
      window.history.pushState(null, '', href);
      setMenuOpen(false);
    }
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
                onClick={e => {
                  handleHashClick(e, href);
                  setMenuOpen(false);
                }}
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
