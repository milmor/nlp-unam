import type { Metadata } from 'next';
import { Crimson_Pro, Source_Sans_3 } from 'next/font/google';
import './globals.css';
import ThemeProvider from '@/components/ThemeProvider';
import Header from '@/components/Header';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-crimson',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-source-sans',
  display: 'swap',
});

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'NLP with Deep Learning - UNAM',
  description: 'Natural Language Processing with Deep Learning course at the School of Engineering, UNAM.',
  icons: {
    icon: [
      { url: `${BASE_PATH}/assets/favicon-32.png?v=3`, sizes: '32x32', type: 'image/png' },
      { url: `${BASE_PATH}/favicon.ico?v=3`, sizes: 'any' },
    ],
    apple: [{ url: `${BASE_PATH}/assets/apple-touch-icon.png`, sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${crimsonPro.variable} ${sourceSans.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Header />
          <Nav />
          <main className="main">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
