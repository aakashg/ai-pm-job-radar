import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI PM Job Radar',
  description: 'Every open PM role at 36 AI and tech companies, sorted into AI PM (no ML needed), AI PM (ML needed), non-AI PM, and not PM.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <Link href="/" className="brand">AI PM Job Radar</Link>
          <nav>
            <Link href="/">Roles</Link>
            <Link href="/methods">Methods</Link>
            <a href="https://github.com/aakashg/ai-pm-job-radar">GitHub</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="foot">
          Built by <a href="https://www.linkedin.com/in/aagupta/">Aakash Gupta</a>. Labels by{' '}
          <a href="https://docs.typesafe.ai">Jev</a> via Vercel AI Gateway. Postings come from public careers boards; always check the original listing.
        </footer>
      </body>
    </html>
  );
}
