'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { canAccessAudit } from '../../modules/audit/lib/audit-access';
import { useAuth } from '../../modules/auth/hooks/use-auth';
import { useAppExperienceMode } from '../../modules/auth/hooks/use-app-experience-mode';
import {
  canAccessDashboard,
  canAccessDriverTools,
  hasStartedDriverFlow,
} from '../../modules/auth/lib/app-access';
import { getOperationalAccessState } from '../../modules/auth/lib/operational-context';

type ProtectedRouteProps = Readonly<{
  children: React.ReactNode;
}>;

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { authSession, isHydrated } = useAuth();
  const requiresOnboarding = authSession?.user.requiresOnboarding ?? false;
  const isProfileRoute = pathname === '/perfil';
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const canUseDriverRoutes = canAccessDriverTools(authSession?.user);
  const hasDriverProcessStarted = hasStartedDriverFlow(authSession?.user);
  const { isDriverExperienceActive } = useAppExperienceMode(authSession?.user);
  const isDriverOnlyRoute =
    pathname === '/vehiculos'
    || pathname === '/viajes/nuevo'
    || pathname === '/viajes/aprobar-solicitudes';
  const isDriverFlowRoute = pathname === '/conductor';
  const isDashboardRoute = pathname === '/dashboard';
  const isAdminOnlyRoute =
    pathname === '/auditoria' ||
    pathname === '/moderacion' ||
    pathname === '/usuarios' ||
    pathname === '/configuracion';
  const canUseAdminRoutes = canAccessAudit(authSession?.user);
  const canUseDashboard = canAccessDashboard(authSession?.user);

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
      return;
    }

    if (authSession && isDriverOnlyRoute && !canUseDriverRoutes) {
      router.replace('/conductor');
      return;
    }

    if (authSession && isDriverOnlyRoute && !isDriverExperienceActive) {
      router.replace('/inicio');
      return;
    }

    if (authSession && isDriverFlowRoute && hasDriverProcessStarted && !isDriverExperienceActive) {
      router.replace('/inicio');
      return;
    }

    if (authSession && isDashboardRoute && !canUseDashboard) {
      router.replace('/inicio');
      return;
    }

    if (authSession && isAdminOnlyRoute && !canUseAdminRoutes) {
      router.replace('/inicio');
    }
  }, [
    authSession,
    canUseAdminRoutes,
    canUseDashboard,
    canUseDriverRoutes,
    hasDriverProcessStarted,
    isAdminOnlyRoute,
    isDashboardRoute,
    isDriverFlowRoute,
    isDriverOnlyRoute,
    isDriverExperienceActive,
    isHydrated,
    isProfileRoute,
    pathname,
    requiresOnboarding,
    router,
  ]);

  if (
    !isHydrated ||
    !authSession ||
    (requiresOnboarding && !isProfileRoute) ||
    (isDriverOnlyRoute && !canUseDriverRoutes) ||
    (isDriverOnlyRoute && !isDriverExperienceActive) ||
    (isDriverFlowRoute && hasDriverProcessStarted && !isDriverExperienceActive) ||
    (isDashboardRoute && !canUseDashboard) ||
    (isAdminOnlyRoute && !canUseAdminRoutes)
  ) {
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
              Estamos validando tu sesion para mostrarte la informacion de SafeRidePro.
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
