'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { label: 'Overview', href: '/#overview' },
  { label: 'Syllabus', href: '/#syllabus' },
  { label: 'Prerequisites', href: '/prerequisites' },
  { label: 'Guidelines', href: '/guidelines' },
  { label: 'Instructor', href: '/#instructor' },
  { label: 'Student Experiences', href: '/testimonials' },
];

export default function Nav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href.startsWith('/#')) return pathname === '/';
    return pathname === href;
  }

  return (
    <nav className="nav">
      <div className="container">
        <ul className="nav-links">
          {navLinks.map(({ label, href }) => (
            <li key={href}>
              <Link href={href} className={isActive(href) ? 'active' : ''}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
