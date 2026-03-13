'use client';

import { useState } from 'react';

interface TestimonialCardProps {
  quote: string;
  semester: string;
  className?: string;
}

const TRUNCATE_LENGTH = 300;

export default function TestimonialCard({ quote, semester, className = '' }: TestimonialCardProps) {
  const isLong = quote.length > TRUNCATE_LENGTH;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`testimonial-card${className ? ` ${className}` : ''}`}>
      <div className={`quote${isLong && !expanded ? ' truncated' : ''}${isLong && expanded ? ' expanded' : ''}`}>
        {quote}
      </div>
      {isLong && (
        <button className="read-more-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Leer menos ↑' : 'Leer más ↓'}
        </button>
      )}
      <div className="author">
        <div className="author-info">
          <strong>Anonymous Student</strong>
          <span>{semester}</span>
        </div>
      </div>
    </div>
  );
}
