import type { Metadata } from 'next';

import './globals.css'; // or your styles
import Providers from '@/components/provider';

export const metadata: Metadata = {
  title: 'Paylynx',
  description: 'AI-Powered Remittance',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}