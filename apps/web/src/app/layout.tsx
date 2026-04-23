import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { FlashToastHost } from '../components/ui/flash-toast-host';
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
    <html lang="es" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <FlashToastHost />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
