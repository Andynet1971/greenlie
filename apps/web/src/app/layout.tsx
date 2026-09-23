import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Greenlie',
  description: 'Your monitoring is green. Is it lying?',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <a href="/" className="brand">
            Greenlie
          </a>
        </header>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
