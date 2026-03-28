import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AuthProvider } from '../modules/auth/components/auth-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'SafeRidePro',
  description: 'Plataforma web para transporte seguro compartido entre estudiantes.',
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

