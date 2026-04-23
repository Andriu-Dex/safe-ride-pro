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
      <main className="auth-loading-shell">
        <div className="auth-loading-card">
          <div aria-hidden="true" className="auth-loading-orbit">
            <span className="auth-loading-core" />
            <span className="auth-loading-ring auth-loading-ring-a" />
            <span className="auth-loading-ring auth-loading-ring-b" />
            <span className="auth-loading-dot auth-loading-dot-a" />
            <span className="auth-loading-dot auth-loading-dot-b" />
          </div>

          <div className="auth-loading-copy">
            <p className="auth-loading-kicker">Acceso seguro</p>
            <h1 className="auth-loading-title">Preparando tu panel inteligente</h1>
            <p className="auth-loading-text">
              Estamos validando tu sesión para mostrarte la información de SafeRidePro.
            </p>
          </div>

          <div aria-hidden="true" className="auth-loading-progress">
            <span className="auth-loading-progress-bar" />
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}


