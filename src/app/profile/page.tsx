import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Emilio Morales - Profile',
  description:
    'Profile of Prof. Emilio Morales — NLP, deep learning, and generative models at UNAM.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfilePage() {
  return (
    <section className="section profile-page">
      <div className="container">
        <p className="profile-back">
          <Link href="/">← Back to NLP course website</Link>
        </p>

        <h2>Emilio Morales</h2>
        <p className="section-intro">
          Professor at the School of Engineering, Universidad Nacional Autónoma de México (UNAM).
        </p>

        <div className="instructor-card profile-card">
          <div className="instructor-info">
            <h3>Prof. Emilio Alejandro Morales Juárez</h3>
            <p className="title">
              School of Engineering · Universidad Nacional Autónoma de México
            </p>
            <p className="bio">
              I work on natural language processing and deep learning, with a focus on generative
              models for language, vision, audio, and multimodal systems. I teach the Natural Language
              Processing with Deep Learning course at FI-UNAM and collaborate on applied AI projects
              involving generative architectures for text, image, and audiovisual media.
            </p>
            <div className="contact-info">
              <p>
                <strong>Email:</strong>{' '}
                <a href="mailto:emilio.morales@ciencias.unam.mx">emilio.morales@ciencias.unam.mx</a>
              </p>
              <p>
                <strong>Institution:</strong> School of Engineering, UNAM
              </p>
              <p>
                <strong>Location:</strong> Ciudad Universitaria, CDMX
              </p>
              <p>
                <strong>GitHub:</strong>{' '}
                <a href="https://github.com/milmor" target="_blank" rel="noopener noreferrer">
                  github.com/milmor
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="course-details-grid profile-grid">
          <div className="detail-card">
            <h4>Research interests</h4>
            <ul className="profile-list">
              <li>Natural language processing</li>
              <li>Deep learning &amp; Transformers</li>
              <li>Generative models (GANs, diffusion, VAEs)</li>
              <li>Multimodal learning (text, image, audio, video)</li>
              <li>Music / audio generation</li>
            </ul>
          </div>

          <div className="detail-card">
            <h4>Teaching</h4>
            <ul className="profile-list">
              <li>
                NLP with Deep Learning — School of Engineering, UNAM (2023–present)
              </li>
              <li>Deep Learning — IIMAS, UNAM</li>
              <li>Machine Learning — IIMAS, UNAM</li>
              <li>Neural Networks — Facultad de Ciencias, UNAM</li>
              <li>Computational Linguistics — Facultad de Ciencias, UNAM</li>
            </ul>
          </div>

          <div className="detail-card">
            <h4>Selected work</h4>
            <ul className="profile-list">
              <li>
                <a
                  href="https://arxiv.org/abs/2401.09596"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Efficient GANs using linear additive-attention Transformers (LadaGAN)
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/milmor/LadaGAN"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LadaGAN — code
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/milmor/NLP"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  NLP course materials (GitHub)
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="profile-course-cta">
          <p>
            Looking for the course site (syllabus, guidelines, submissions)?
          </p>
          <Link href="/" className="btn-primary btn-small">
            Open NLP course website →
          </Link>
        </div>
      </div>
    </section>
  );
}
