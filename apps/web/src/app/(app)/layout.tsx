import type { ReactNode } from 'react';

import { AuthenticatedShell } from '../../components/layout/authenticated-shell';
import { ProtectedRoute } from '../../components/layout/protected-route';

type AppLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <ProtectedRoute>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </ProtectedRoute>
  );
}


