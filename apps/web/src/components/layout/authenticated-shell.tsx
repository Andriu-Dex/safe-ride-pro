'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuth } from '../../modules/auth/hooks/use-auth';
import { canAccessAudit } from '../../modules/audit/lib/audit-access';
import { getOperationalAccessState } from '../../modules/auth/lib/operational-context';
import { getUserInitials } from '../../modules/users/lib/get-user-initials';
import { AppLogo } from '../ui/app-logo';
import { Button } from '../ui/button';
import styles from './authenticated-shell.module.css';

const COMPANY_LOGO_URL = 'https://i.imgur.com/HMtKckK.png';

const NAV_ITEMS = [
  {
    href: '/perfil',
    label: 'Perfil',
    subtitle: 'Cuenta y seguridad',
    requiresOperationalMembership: false,
    icon: 'profile',
  },
  {
    href: '/inicio',
    label: 'Inicio',
    subtitle: 'Resumen operativo',
    requiresOperationalMembership: false,
    icon: 'home',
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    subtitle: 'Indicadores en tiempo real',
    requiresOperationalMembership: false,
    icon: 'dashboard',
  },
  {
    href: '/conductor',
    label: 'Conductor',
    subtitle: 'Estado y requisitos',
    requiresOperationalMembership: true,
    icon: 'driver',
  },
  {
    href: '/vehiculos',
    label: 'Vehículos',
    subtitle: 'Flota y habilitación',
    requiresOperationalMembership: true,
    icon: 'vehicle',
  },
  {
    href: '/viajes',
    label: 'Viajes',
    subtitle: 'Despacho y seguimiento',
    requiresOperationalMembership: true,
    icon: 'trip',
  },
  {
    href: '/confianza',
    label: 'Confianza',
    subtitle: 'Calidad y reputación',
    requiresOperationalMembership: true,
    icon: 'trust',
  },
  {
    href: '/auditoria',
    label: 'Auditoría',
    subtitle: 'Trazabilidad y control',
    requiresOperationalMembership: false,
    icon: 'audit',
  },
] as const;

type NavIconName = (typeof NAV_ITEMS)[number]['icon'];

type AuthenticatedShellProps = Readonly<{
  children: React.ReactNode;
}>;

function NavIcon({ name }: { name: NavIconName }) {
  switch (name) {
    case 'home':
      return (
        <svg aria-hidden="true" className={styles.navIcon} viewBox="0 0 24 24">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M6.5 10.5V20h11V10.5" />
        </svg>
      );
    case 'profile':
      return (
        <svg aria-hidden="true" className={styles.navIcon} viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5 19c1.8-3.2 4-4.8 7-4.8s5.2 1.6 7 4.8" />
        </svg>
      );
    case 'dashboard':
      return (
        <svg aria-hidden="true" className={styles.navIcon} viewBox="0 0 24 24">
          <rect x="4" y="4" width="7" height="7" rx="1.2" />
          <rect x="13" y="4" width="7" height="4.5" rx="1.2" />
          <rect x="13" y="10.5" width="7" height="9.5" rx="1.2" />
          <rect x="4" y="13" width="7" height="7" rx="1.2" />
        </svg>
      );
    case 'driver':
      return (
        <svg aria-hidden="true" className={styles.navIcon} viewBox="0 0 24 24">
          <path d="M7 15.5h10l-1-4.5H8l-1 4.5Z" />
          <circle cx="9" cy="17.5" r="1.3" />
          <circle cx="15" cy="17.5" r="1.3" />
          <path d="M8.2 11 10 7.5h4L15.8 11" />
        </svg>
      );
    case 'vehicle':
      return (
        <svg aria-hidden="true" className={styles.navIcon} viewBox="0 0 24 24">
          <path d="M5 15h14l-1.1-5H6.1L5 15Z" />
          <circle cx="8.5" cy="16.8" r="1.4" />
          <circle cx="15.5" cy="16.8" r="1.4" />
          <path d="M6.2 10 8 6.8h8L17.8 10" />
        </svg>
      );
    case 'trip':
      return (
        <svg aria-hidden="true" className={styles.navIcon} viewBox="0 0 24 24">
          <path d="M6 19c4.2-2.3 7.8-6.2 10-11" />
          <path d="m13 8 3.7-.2L17 11" />
          <circle cx="6" cy="19" r="1.6" />
          <circle cx="17" cy="8" r="1.6" />
        </svg>
      );
    case 'trust':
      return (
        <svg aria-hidden="true" className={styles.navIcon} viewBox="0 0 24 24">
          <path d="M12 4 5 7v4.8c0 4.4 2.8 7.6 7 8.9 4.2-1.3 7-4.5 7-8.9V7l-7-3Z" />
          <path d="m9 12.2 2 2 4-4" />
        </svg>
      );
    case 'audit':
      return (
        <svg aria-hidden="true" className={styles.navIcon} viewBox="0 0 24 24">
          <path d="M8 4.5h8" />
          <path d="M9 4.5v3h6v-3" />
          <rect x="5" y="7.5" width="14" height="12" rx="2" />
          <path d="M8.5 11.5h7M8.5 15h4.5" />
        </svg>
      );
    default:
      return null;
  }
}

export function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { authSession, signOut } = useAuth();
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
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
    <div
      className={[
        styles.shell,
        isSidebarHidden ? styles.shellSidebarHidden : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        aria-label={isSidebarHidden ? 'Mostrar panel lateral' : 'Ocultar panel lateral'}
        className={styles.toggleButton}
        onClick={() => setIsSidebarHidden((currentValue) => !currentValue)}
        title={isSidebarHidden ? 'Mostrar panel' : 'Ocultar panel'}
        type="button"
      >
        {isSidebarHidden ? (
          <svg aria-hidden="true" className={styles.toggleIcon} viewBox="0 0 24 24">
            <path d="m9 6 6 6-6 6" />
          </svg>
        ) : (
          <svg aria-hidden="true" className={styles.toggleIcon} viewBox="0 0 24 24">
            <path d="m15 6-6 6 6 6" />
          </svg>
        )}
      </button>

      <aside className={styles.sidebar}>
        <section className={styles.userCard}>
          <p className={styles.cardLabel}>Sesión activa</p>
          <div className={styles.userSummary}>
            <div className={styles.userAvatar} aria-hidden="true">
              {authSession?.user.profilePhotoUrl ? (
                <img
                  alt=""
                  className={styles.userAvatarImage}
                  src={authSession.user.profilePhotoUrl}
                />
              ) : (
                <div className={styles.userAvatarFallback}>{userInitials}</div>
              )}
            </div>
            <div className={styles.userIdentity}>
              <strong>{authSession?.user.fullName}</strong>
              <p>{currentMembership?.institutionName ?? 'Institucion no disponible'}</p>
              <p>{authSession?.user.email}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={handleSignOut}>
            Cerrar sesión
          </Button>
        </section>

        <div className={styles.sidebarMain}>
          <section className={styles.navCard}>
            <p className={styles.cardLabel}>Navegación</p>
            <nav>
              <ul className={styles.navList}>
              {NAV_ITEMS.filter((item) => auditVisible || item.href !== '/auditoria').map((item) => {
                const isActive = pathname === item.href;
                const isDisabled =
                  (requiresOnboarding && item.href !== '/perfil') ||
                  (item.requiresOperationalMembership &&
                    !operationalAccess.hasOperationalMembership);

                if (isDisabled) {
                  return (
                    <li
                      key={item.href}
                      aria-disabled="true"
                      className={styles.navLinkDisabled}
                    >
                      <NavIcon name={item.icon} />
                      <div className={styles.navText}>
                        <strong>{item.label}</strong>
                        <span>{item.subtitle}</span>
                      </div>
                      <span className={styles.navMeta}>Bloq.</span>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      className={[
                        styles.navLink,
                        isActive ? styles.navLinkActive : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      href={item.href}
                    >
                      <NavIcon name={item.icon} />
                      <div className={styles.navText}>
                        <strong>{item.label}</strong>
                        <span>{item.subtitle}</span>
                      </div>
                      <span className={styles.navMeta}>{isActive ? 'Activo' : 'Ir'}</span>
                    </Link>
                  </li>
                );
              })}
              </ul>
            </nav>
          </section>

          {!operationalAccess.hasOperationalMembership &&
          operationalAccess.title &&
          operationalAccess.message ? (
            <section className={styles.noteCard}>
              <p className={styles.cardLabel}>Acceso operativo</p>
              <strong>{operationalAccess.title}</strong>
              <p>{operationalAccess.message}</p>
            </section>
          ) : null}

          {requiresOnboarding ? (
            <section className={styles.noteCard}>
              <p className={styles.cardLabel}>Onboarding pendiente</p>
              <strong>Completa tu perfil antes de operar.</strong>
              <p>
                Necesitas terminar tu perfil y aceptar las reglas base para usar el resto
                de módulos de SafeRidePro.
              </p>
            </section>
          ) : null}
        </div>

        <section className={styles.sidebarFooter}>
          <p className={styles.cardLabel}>Sistema</p>
          <AppLogo
            avatarUrl={COMPANY_LOGO_URL}
            initials={userInitials}
          />
        </section>
      </aside>

      <div className={styles.content}>
        {children}
      </div>
    </div>
  );
}


