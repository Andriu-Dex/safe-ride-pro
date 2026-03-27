import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'SafeRidePro',
  description: 'Transporte seguro compartido para estudiantes.',
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps): JSX.Element {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
