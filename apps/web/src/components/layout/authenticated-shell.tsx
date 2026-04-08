'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '../../modules/auth/hooks/use-auth';
import { canAccessAudit } from '../../modules/audit/lib/audit-access';
import { getOperationalAccessState } from '../../modules/auth/lib/operational-context';
import { getUserInitials } from '../../modules/users/lib/get-user-initials';
import { AppLogo } from '../ui/app-logo';
import { Button } from '../ui/button';

const NAV_ITEMS = [
  { href: '/perfil', label: 'Perfil', requiresOperationalMembership: false },
  { href: '/inicio', label: 'Inicio', requiresOperationalMembership: false },
  { href: '/dashboard', label: 'Dashboard', requiresOperationalMembership: false },
  { href: '/conductor', label: 'Conductor', requiresOperationalMembership: true },
  { href: '/vehiculos', label: 'Vehiculos', requiresOperationalMembership: true },
  { href: '/viajes', label: 'Viajes', requiresOperationalMembership: true },
  { href: '/confianza', label: 'Confianza', requiresOperationalMembership: true },
  { href: '/auditoria', label: 'Auditoria', requiresOperationalMembership: false },
] as const;

type AuthenticatedShellProps = Readonly<{
  children: React.ReactNode;
}>;

export function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { authSession, signOut } = useAuth();
  const requiresOnboarding = authSession?.user.requiresOnboarding ?? false;
  const auditVisible = canAccessAudit(authSession?.user);

  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const currentMembership =
    operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
  const userInitials = getUserInitials(authSession?.user.fullName);

  const handleSignOut = (): void => {
    signOut();
    router.replace('/login');
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <AppLogo
          avatarUrl={authSession?.user.profilePhotoUrl}
          initials={userInitials}
        />

        <section className="sidebar-section">
          <p className="sidebar-label">Navegacion</p>
          <nav className="sidebar-nav">
            {NAV_ITEMS.filter((item) => auditVisible || item.href !== '/auditoria').map((item) => {
              const isActive = pathname === item.href;
              const isDisabled =
                (requiresOnboarding && item.href !== '/perfil') ||
                (item.requiresOperationalMembership &&
                  !operationalAccess.hasOperationalMembership);

              if (isDisabled) {
                return (
                  <div
                    key={item.href}
                    aria-disabled="true"
                    className="sidebar-link sidebar-link-disabled"
                  >
                    <span>{item.label}</span>
                    <span>Bloqueado</span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  className={[
                    'sidebar-link',
                    isActive ? 'sidebar-link-active' : '',
                  ].filter(Boolean).join(' ')}
                  href={item.href}
                >
                  <span>{item.label}</span>
                  <span>{isActive ? 'Activo' : 'Ir'}</span>
                </Link>
              );
            })}
          </nav>
        </section>

        {!operationalAccess.hasOperationalMembership &&
        operationalAccess.title &&
        operationalAccess.message ? (
          <section className="sidebar-note sidebar-note-warning">
            <p className="sidebar-label">Acceso operativo</p>
            <strong>{operationalAccess.title}</strong>
            <p>{operationalAccess.message}</p>
          </section>
        ) : null}

        {requiresOnboarding ? (
          <section className="sidebar-note sidebar-note-warning">
            <p className="sidebar-label">Onboarding pendiente</p>
            <strong>Completa tu perfil antes de operar.</strong>
            <p>
              Necesitas terminar tu perfil y aceptar las reglas base para usar el resto
              de modulos de SafeRidePro.
            </p>
          </section>
        ) : null}

        <div className="sidebar-spacer" />

        <section className="sidebar-user-card">
          <p className="sidebar-label">Sesion activa</p>
          <div className="sidebar-user-summary">
            <div className="sidebar-user-avatar" aria-hidden="true">
              {authSession?.user.profilePhotoUrl ? (
                <img
                  alt=""
                  className="sidebar-user-avatar-image"
                  src={authSession.user.profilePhotoUrl}
                />
              ) : (
                <div className="sidebar-user-avatar-fallback">{userInitials}</div>
              )}
            </div>
            <div className="sidebar-user-identity">
              <strong>{authSession?.user.fullName}</strong>
              <p>{currentMembership?.institutionName ?? 'Institucion no disponible'}</p>
              <p>{authSession?.user.email}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={handleSignOut}>
            Cerrar sesion
          </Button>
        </section>
      </aside>

      <div className="app-content">{children}</div>
    </div>
  );
}


