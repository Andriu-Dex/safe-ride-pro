'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '../../modules/auth/hooks/use-auth';

type ProtectedRouteProps = Readonly<{
  children: React.ReactNode;
}>;

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { authSession, isHydrated } = useAuth();
  const requiresOnboarding = authSession?.user.requiresOnboarding ?? false;
  const isProfileRoute = pathname === '/perfil';

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (requiresOnboarding && !isProfileRoute) {
      router.replace(`/perfil?next=${encodeURIComponent(pathname)}`);
    }
  }, [authSession, isHydrated, isProfileRoute, pathname, requiresOnboarding, router]);

  if (!isHydrated || !authSession || (requiresOnboarding && !isProfileRoute)) {
    return (
      <main className="loading-state">
        <div className="loading-card">
          <div aria-hidden="true" className="loading-pulse" />
          <h1 className="panel-title">Preparando tu panel</h1>
          <p className="panel-text">
            Estamos validando tu sesion para mostrarte la informacion de SafeRidePro.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}


