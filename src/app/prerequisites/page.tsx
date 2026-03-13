import type { Metadata } from 'next';
import RadarChart from '@/components/RadarChart';

export const metadata: Metadata = {
  title: 'Student Background - NLP with Deep Learning - UNAM',
};

const prerequisitesData = {
  '2026-1': { calculus: 2.33, linear_algebra: 2.0, probability: 2.33, statistics: 2.67, programming: 4.0 },
  '2025-2': { calculus: 3.5, linear_algebra: 2.5, probability: 3.5, statistics: 3.0, programming: 4.0 },
  '2025-1': { calculus: 3.0, linear_algebra: 3.0, probability: 2.67, statistics: 3.67, programming: 4.0 },
  '2024-2': { calculus: 3.25, linear_algebra: 3.25, probability: 3.75, statistics: 3.75, programming: 4.5 },
  '2024-1': { calculus: 3.67, linear_algebra: 3.5, probability: 3.17, statistics: 3.33, programming: 4.0 },
} as const;

const responses: Record<string, number> = {
  '2026-1': 3,
  '2025-2': 2,
  '2025-1': 3,
  '2024-2': 4,
  '2024-1': 6,
};

export default function PrerequisitesPage() {
  return (
    <section className="section">
      <div className="container">
        <h2>Prerequisites</h2>
        <div className="prereq-info" style={{ marginBottom: '2rem' }}>
          <h3>What you need to take this course</h3>
          <p>This course requires strong foundations in:</p>
          <ul>
            <li><strong>Linear Algebra</strong> – matrices, vectors, transformations</li>
            <li><strong>Calculus</strong> – derivatives, gradients, chain rule</li>
            <li><strong>Probability &amp; Statistics</strong> – distributions, Bayes&apos; theorem</li>
            <li><strong>Programming</strong> – Python proficiency required</li>
          </ul>
        </div>

        <h2>Student Background Knowledge</h2>
        <p className="section-intro">
          At the end of each semester, students were asked:{' '}
          <em>
            &ldquo;Did you have sufficient background knowledge to take and benefit from the course?&rdquo;
          </em>{' '}
          (Scale: 1 = Insufficient, 5 = Sufficient)
        </p>

        <div className="charts-grid">
          {(Object.entries(prerequisitesData) as [string, typeof prerequisitesData['2026-1']][]).map(
            ([semester, data]) => (
              <RadarChart
                key={semester}
                semester={semester}
                data={data}
                responses={responses[semester]}
              />
            )
          )}
        </div>

        <div className="prereq-info">
          <h3>Recommended Prerequisites</h3>
          <p>
            Based on student feedback across semesters, we recommend the following background before taking
            this course:
          </p>
          <ul>
            <li>
              <strong>Programming:</strong> Students consistently report strong programming skills (avg ~4.0/5).
              Python experience is essential.
            </li>
            <li>
              <strong>Linear Algebra:</strong> Often cited as challenging (avg ~2.8/5). Review matrices,
              vectors, and transformations.
            </li>
            <li>
              <strong>Calculus:</strong> Derivatives and gradients are used throughout (avg ~3.2/5).
            </li>
            <li>
              <strong>Probability &amp; Statistics:</strong> Understanding distributions and basic stats helps
              (avg ~3.2/5).
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
