'use client';

import { DriverVerificationStatus } from '@saferidepro/shared-types';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { canAccessAudit } from '../../modules/audit/lib/audit-access';
import { useAuth } from '../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../modules/auth/lib/operational-context';
import { NotificationBell } from '../../modules/notifications/components/notification-bell';
import { getUserInitials } from '../../modules/users/lib/get-user-initials';
import { AppLogo } from '../ui/app-logo';
import { Button } from '../ui/button';
import styles from './authenticated-shell.module.css';

const COMPANY_LOGO_URL = 'https://i.imgur.com/HMtKckK.png';

const NAV_ITEMS = [
  {
    href: '/inicio',
    label: 'Inicio',
    subtitle: 'Principal',
    requiresOperationalMembership: false,
    icon: 'home',
    audience: 'all',
  },
  {
    href: '/viajes',
    label: 'Viajes',
    subtitle: 'Movilidad',
    requiresOperationalMembership: true,
    icon: 'trip',
    audience: 'passenger',
  },
  {
    href: '/confianza',
    label: 'Confianza',
    subtitle: 'Estado',
    requiresOperationalMembership: true,
    icon: 'trust',
    audience: 'all',
  },
  {
    href: '/conductor',
    label: 'Conductor',
    subtitle: 'Conducir',
    requiresOperationalMembership: true,
    icon: 'driver',
    audience: 'all',
  },
  {
    href: '/viajes/nuevo',
    label: 'Nuevo viaje',
    subtitle: 'Publicar',
    requiresOperationalMembership: true,
    icon: 'trip',
    audience: 'driver',
  },
  {
    href: '/vehiculos',
    label: 'Vehiculos',
    subtitle: 'Flota',
    requiresOperationalMembership: true,
    icon: 'vehicle',
    audience: 'driver',
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    subtitle: 'Reportes',
    requiresOperationalMembership: true,
    icon: 'dashboard',
    audience: 'all',
  },
  {
    href: '/auditoria',
    label: 'Auditoria',
    subtitle: 'Control interno',
    requiresOperationalMembership: false,
    icon: 'audit',
    audience: 'admin',
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

function getDisplayName(fullName?: string): string {
  if (!fullName) {
    return 'Usuario';
  }

  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { authSession, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const requiresOnboarding = authSession?.user.requiresOnboarding ?? false;
  const auditVisible = canAccessAudit(authSession?.user);
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const currentMembership =
    operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
  const userInitials = getUserInitials(authSession?.user.fullName);
  const displayName = getDisplayName(authSession?.user.fullName);
  const isApprovedDriver =
    currentMembership?.effectiveDriverVerificationStatus === DriverVerificationStatus.Approved ||
    currentMembership?.driverVerificationStatus === DriverVerificationStatus.Approved;

  const visibleNavItems = useMemo(
    () =>
      NAV_ITEMS.filter((item) => {
        if (item.audience === 'admin') {
          return auditVisible;
        }

        if (item.audience === 'driver') {
          return isApprovedDriver;
        }

        return true;
      }).map((item) =>
        item.href === '/conductor'
          ? {
              ...item,
              label: isApprovedDriver ? 'Conductor' : 'Ser conductor',
            }
          : item,
      ),
    [auditVisible, isApprovedDriver],
  );

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.removeProperty('overflow');
      return;
    }

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.removeProperty('overflow');
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSignOut = () => {
    signOut();
    router.replace('/login');
  };

  const renderNavItem = (
    item: (typeof visibleNavItems)[number],
    mode: 'desktop' | 'mobile',
  ) => {
    const isActive = pathname === item.href;
    const isDisabled =
      requiresOnboarding ||
      (item.requiresOperationalMembership && !operationalAccess.hasOperationalMembership);

    if (isDisabled) {
      return (
        <li
          key={`${mode}-${item.href}`}
          aria-disabled="true"
          className={mode === 'desktop' ? styles.desktopNavItemDisabled : styles.mobileNavItemDisabled}
        >
          <NavIcon name={item.icon} />
          <div className={mode === 'desktop' ? styles.desktopNavCopy : styles.mobileNavCopy}>
            <strong>{item.label}</strong>
            {mode === 'mobile' ? <span>{item.subtitle}</span> : null}
          </div>
        </li>
      );
    }

    return (
      <li key={`${mode}-${item.href}`}>
        <Link
          className={[
            mode === 'desktop' ? styles.desktopNavLink : styles.mobileNavLink,
            isActive
              ? mode === 'desktop'
                ? styles.desktopNavLinkActive
                : styles.mobileNavLinkActive
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          href={item.href}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <NavIcon name={item.icon} />
          <div className={mode === 'desktop' ? styles.desktopNavCopy : styles.mobileNavCopy}>
            <strong>{item.label}</strong>
            {mode === 'mobile' ? <span>{item.subtitle}</span> : null}
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarGlow} aria-hidden="true" />

        <div className={styles.topbarLeft}>
          <button
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
            className={styles.mobileMenuButton}
            onClick={() => setIsMobileMenuOpen((currentValue) => !currentValue)}
            type="button"
          >
            <svg aria-hidden="true" className={styles.toggleIcon} viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path d="M6 6 18 18M18 6 6 18" />
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
          </button>

          <Link className={styles.brandLink} href="/inicio">
            <AppLogo avatarUrl={COMPANY_LOGO_URL} initials={userInitials} />
          </Link>
        </div>

        <nav aria-label="Principal" className={styles.desktopNav}>
          <ul className={styles.desktopNavList}>
            {visibleNavItems.map((item) => renderNavItem(item, 'desktop'))}
          </ul>
        </nav>

        <div className={styles.topbarRight}>
          <NotificationBell accessToken={authSession?.accessToken} />

          <div className={styles.userMenuWrap} ref={userMenuRef}>
            <button
              aria-expanded={isUserMenuOpen}
              aria-label="Abrir menu de usuario"
              className={styles.userMenuTrigger}
              onClick={() => setIsUserMenuOpen((currentValue) => !currentValue)}
              type="button"
            >
              <div className={styles.userMenuIdentity}>
                <strong>{displayName}</strong>
              </div>

              <div className={styles.userMenuAvatar} aria-hidden="true">
                {authSession?.user.profilePhotoUrl ? (
                  <img
                    alt=""
                    className={styles.userMenuAvatarImage}
                    src={authSession.user.profilePhotoUrl}
                  />
                ) : (
                  <span>{userInitials}</span>
                )}
              </div>
            </button>

            {isUserMenuOpen ? (
              <div className={styles.userMenuDropdown}>
                <Link
                  className={styles.userMenuItem}
                  href="/perfil"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  Perfil
                </Link>
                <button className={styles.userMenuItem} onClick={handleSignOut} type="button">
                  Cerrar sesion
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <button
        aria-hidden={!isMobileMenuOpen}
        className={styles.mobileBackdrop}
        onClick={() => setIsMobileMenuOpen(false)}
        tabIndex={isMobileMenuOpen ? 0 : -1}
        type="button"
      />

      <aside
        className={[styles.mobileDrawer, isMobileMenuOpen ? styles.mobileDrawerOpen : '']
          .filter(Boolean)
          .join(' ')}
      >
        <section className={styles.mobileProfileCard}>
          <div className={styles.userAvatar} aria-hidden="true">
            {authSession?.user.profilePhotoUrl ? (
              <img alt="" className={styles.userAvatarImage} src={authSession.user.profilePhotoUrl} />
            ) : (
              <div className={styles.userAvatarFallback}>{userInitials}</div>
            )}
          </div>
          <div className={styles.mobileProfileCopy}>
            <strong>{authSession?.user.fullName}</strong>
            <p>{currentMembership?.institutionName ?? 'Institucion no disponible'}</p>
          </div>
        </section>

        <nav aria-label="Navegacion movil" className={styles.mobileNav}>
          <ul className={styles.mobileNavList}>
            {visibleNavItems.map((item) => renderNavItem(item, 'mobile'))}
            <li>
              <Link
                className={[
                  styles.mobileNavLink,
                  pathname === '/perfil' ? styles.mobileNavLinkActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                href="/perfil"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className={styles.mobileNavCopy}>
                  <strong>Perfil</strong>
                  <span>Mi cuenta</span>
                </div>
              </Link>
            </li>
          </ul>
        </nav>

        {!operationalAccess.hasOperationalMembership &&
        operationalAccess.title &&
        operationalAccess.message ? (
          <section className={styles.noteCard}>
            <p className={styles.noteLabel}>Acceso</p>
            <strong>{operationalAccess.title}</strong>
            <p>{operationalAccess.message}</p>
          </section>
        ) : null}

        {requiresOnboarding ? (
          <section className={styles.noteCard}>
            <p className={styles.noteLabel}>Perfil pendiente</p>
            <strong>Completa tu perfil para continuar.</strong>
          </section>
        ) : null}

        <div className={styles.mobileDrawerFooter}>
          <NotificationBell accessToken={authSession?.accessToken} />
          <Button variant="secondary" onClick={handleSignOut}>
            Cerrar sesion
          </Button>
        </div>
      </aside>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
