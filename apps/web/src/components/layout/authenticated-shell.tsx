'use client';

import { DriverVerificationStatus } from '@saferidepro/shared-types';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { persistToast } from '../../components/ui/flash-toast';
import { canAccessAudit } from '../../modules/audit/lib/audit-access';
import { useAuth } from '../../modules/auth/hooks/use-auth';
import { useAppExperienceMode } from '../../modules/auth/hooks/use-app-experience-mode';
import { canAccessDashboard } from '../../modules/auth/lib/app-access';
import { getOperationalAccessState } from '../../modules/auth/lib/operational-context';
import { NotificationBell } from '../../modules/notifications/components/notification-bell';
import { getUserInitials } from '../../modules/users/lib/get-user-initials';
import { NavbarLogo } from '../ui/navbar-logo';
import styles from './authenticated-shell.module.css';

const COMPANY_LOGO_URL = 'https://i.imgur.com/ucDoiiZ.png';

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
    href: '/billetera',
    label: 'Billetera',
    subtitle: 'Saldo',
    requiresOperationalMembership: true,
    icon: 'wallet',
    audience: 'all',
  },
  {
    href: '/conductor',
    label: 'Conductor',
    subtitle: 'Conducir',
    requiresOperationalMembership: true,
    icon: 'driver',
    audience: 'driver',
  },
  {
    href: '/viajes/aprobar-solicitudes',
    label: 'Solicitudes',
    subtitle: 'Aprobar',
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
    audience: 'dashboard',
  },
  {
    href: '/moderacion',
    label: 'Moderacion',
    subtitle: 'Gestion',
    requiresOperationalMembership: false,
    icon: 'driver',
    audience: 'admin',
  },
  {
    href: '/usuarios',
    label: 'Usuarios',
    subtitle: 'Cuentas',
    requiresOperationalMembership: false,
    icon: 'profile',
    audience: 'admin',
  },
  {
    href: '/auditoria',
    label: 'Auditoria',
    subtitle: 'Control interno',
    requiresOperationalMembership: false,
    icon: 'audit',
    audience: 'admin',
  },
  {
    href: '/configuracion',
    label: 'Configuracion',
    subtitle: 'Parametros',
    requiresOperationalMembership: false,
    icon: 'settings',
    audience: 'admin',
  },
] as const;

type NavIconName = (typeof NAV_ITEMS)[number]['icon'];

type AuthenticatedShellProps = Readonly<{
  children: React.ReactNode;
}>;

function NavIcon({ name }: { name: NavIconName }) {
  const iconClass = styles.navIcon;
  const strokeProps = { strokeWidth: "2.2", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (name) {
    case 'home':
      return (
        <svg aria-hidden="true" className={iconClass} {...strokeProps} viewBox="0 0 24 24">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M6.5 10.5V20h11V10.5" />
        </svg>
      );
    case 'dashboard':
      return (
        <svg aria-hidden="true" className={iconClass} {...strokeProps} viewBox="0 0 24 24">
          <rect x="4" y="4" width="7" height="7" rx="1.2" />
          <rect x="13" y="4" width="7" height="4.5" rx="1.2" />
          <rect x="13" y="10.5" width="7" height="9.5" rx="1.2" />
          <rect x="4" y="13" width="7" height="7" rx="1.2" />
        </svg>
      );
    case 'driver':
      return (
        <svg aria-hidden="true" className={iconClass} {...strokeProps} viewBox="0 0 24 24">
          <path d="M7 15.5h10l-1-4.5H8l-1 4.5Z" />
          <circle cx="9" cy="17.5" r="1.3" />
          <circle cx="15" cy="17.5" r="1.3" />
          <path d="M8.2 11 10 7.5h4L15.8 11" />
        </svg>
      );
    case 'vehicle':
      return (
        <svg aria-hidden="true" className={iconClass} {...strokeProps} viewBox="0 0 24 24">
          <path d="M5 15h14l-1.1-5H6.1L5 15Z" />
          <circle cx="8.5" cy="16.8" r="1.4" />
          <circle cx="15.5" cy="16.8" r="1.4" />
          <path d="M6.2 10 8 6.8h8L17.8 10" />
        </svg>
      );
    case 'trip':
      return (
        <svg aria-hidden="true" className={iconClass} {...strokeProps} viewBox="0 0 24 24">
          <path d="M6 19c4.2-2.3 7.8-6.2 10-11" />
          <path d="m13 8 3.7-.2L17 11" />
          <circle cx="6" cy="19" r="1.6" />
          <circle cx="17" cy="8" r="1.6" />
        </svg>
      );
    case 'trust':
      return (
        <svg aria-hidden="true" className={iconClass} {...strokeProps} viewBox="0 0 24 24">
          <path d="M12 4 5 7v4.8c0 4.4 2.8 7.6 7 8.9 4.2-1.3 7-4.5 7-8.9V7l-7-3Z" />
          <path d="m9 12.2 2 2 4-4" />
        </svg>
      );
    case 'wallet':
      return (
        <svg aria-hidden="true" className={iconClass} {...strokeProps} viewBox="0 0 24 24">
          <path d="M4 7.5h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 17V6.8A2.3 2.3 0 0 1 5.3 4.5H18" />
          <path d="M16.5 13.5h4.5" />
          <circle cx="17.4" cy="13.5" r=".6" />
        </svg>
      );
    case 'audit':
      return (
        <svg aria-hidden="true" className={iconClass} {...strokeProps} viewBox="0 0 24 24">
          <path d="M8 4.5h8" />
          <path d="M9 4.5v3h6v-3" />
          <rect x="5" y="7.5" width="14" height="12" rx="2" />
          <path d="M8.5 11.5h7M8.5 15h4.5" />
        </svg>
      );
    case 'profile':
      return (
        <svg aria-hidden="true" className={iconClass} {...strokeProps} viewBox="0 0 24 24">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'settings':
      return (
        <svg aria-hidden="true" className={iconClass} {...strokeProps} viewBox="0 0 24 24">
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.4 1Z" />
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

function hasPendingDriverApproval(
  memberships:
    | readonly {
        driverVerificationStatus?: DriverVerificationStatus | null;
        effectiveDriverVerificationStatus?: DriverVerificationStatus | null;
      }[]
    | null
    | undefined,
): boolean {
  if (!memberships?.length) {
    return false;
  }

  return memberships.some((membership) => {
    const effectiveStatus =
      membership.effectiveDriverVerificationStatus ?? membership.driverVerificationStatus;

    return effectiveStatus === DriverVerificationStatus.PendingVerification;
  });
}

export function AuthenticatedShell({ children }: AuthenticatedShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { authSession, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDriverPromptOpen, setIsDriverPromptOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const requiresOnboarding = authSession?.user.requiresOnboarding ?? false;
  const auditVisible = canAccessAudit(authSession?.user);
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const currentMembership =
    operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
  const userInitials = getUserInitials(authSession?.user.fullName);
  const displayName = getDisplayName(authSession?.user.fullName);
  const {
    setExperienceMode,
    canUseDriverMode,
    hasApprovedDriverMode,
    isDriverExperienceActive,
  } = useAppExperienceMode(authSession?.user);
  const isApprovedDriver = hasApprovedDriverMode;
  const dashboardVisible = canAccessDashboard(authSession?.user);
  const isAdminWorkspace = auditVisible;
  const effectiveDriverStatus =
    currentMembership?.effectiveDriverVerificationStatus
    ?? currentMembership?.driverVerificationStatus
    ?? DriverVerificationStatus.NotRequested;
  const hasStartedDriverFlow =
    canUseDriverMode || effectiveDriverStatus !== DriverVerificationStatus.NotRequested;
  const hasPendingApprovalReminder = hasPendingDriverApproval(authSession?.user.memberships);

  const visibleNavItems = useMemo(
    () => {
      if (isAdminWorkspace) {
        return NAV_ITEMS.filter((item) =>
          item.href === '/inicio'
          || item.href === '/dashboard'
          || item.href === '/moderacion'
          || item.href === '/usuarios'
          || item.href === '/auditoria'
          || item.href === '/configuracion');
      }

      return NAV_ITEMS.filter((item) => {
        if (item.audience === 'admin') {
          return auditVisible;
        }

        if (item.href === '/conductor') {
          return isDriverExperienceActive && hasStartedDriverFlow;
        }

        if (item.audience === 'driver') {
          return isApprovedDriver && isDriverExperienceActive;
        }

        if (item.audience === 'dashboard') {
          return dashboardVisible && isDriverExperienceActive;
        }

        return true;
      });
    },
    [
      auditVisible,
      dashboardVisible,
      hasStartedDriverFlow,
      isAdminWorkspace,
      isApprovedDriver,
      isDriverExperienceActive,
    ],
  );
  const desktopPrimaryItems = visibleNavItems.filter((item) => {
    if (isAdminWorkspace) {
      return item.href === '/inicio';
    }

    return item.audience === 'all' || item.audience === 'passenger';
  });
  const desktopDriverItems = visibleNavItems.filter((item) =>
    item.audience === 'driver' || item.audience === 'dashboard');
  const desktopAdminItems = visibleNavItems.filter((item) =>
    item.audience === 'admin' || (isAdminWorkspace && item.href === '/dashboard'));

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
        setIsDriverPromptOpen(false);
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

  const handleDriverEntry = () => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);

    if (isApprovedDriver || hasStartedDriverFlow) {
      setExperienceMode('driver');
      if (hasPendingApprovalReminder) {
        persistToast({
          title: 'Solicitud en revision',
          description: 'Tu solicitud para ser conductor aun no ha sido aprobada. Te avisaremos cuando haya una respuesta.',
          tone: 'info',
        });
      }
      router.push('/conductor');
      return;
    }

    setIsDriverPromptOpen(true);
  };

  const renderNavItem = (
    item: (typeof visibleNavItems)[number],
    mode: 'desktop' | 'mobile',
  ) => {
    const isActive = pathname === item.href;
    const isDisabled =
      requiresOnboarding ||
      (item.requiresOperationalMembership && !operationalAccess.hasOperationalMembership);

    const desktopClassName = [
      styles.desktopNavLink,
      isActive ? styles.desktopNavLinkActive : null,
    ]
      .filter(Boolean)
      .join(' ');
    const mobileClassName = [
      styles.mobileNavLink,
      isActive ? styles.mobileNavLinkActive : null,
    ]
      .filter(Boolean)
      .join(' ');

    if (isDisabled) {
      return (
        <li key={`${mode}-${item.href}`} aria-disabled="true">
          <div
            className={
              mode === 'desktop'
                ? styles.desktopNavItemDisabled
                : styles.mobileNavItemDisabled
            }
          >
            <NavIcon name={item.icon} />
            {mode === 'desktop' ? (
              <span>{item.label}</span>
            ) : (
              <div className={styles.mobileNavCopy}>
                <strong>{item.label}</strong>
                <span>{item.subtitle}</span>
              </div>
            )}
          </div>
        </li>
      );
    }

    return (
      <li key={`${mode}-${item.href}`}>
        <Link
          className={
            mode === 'desktop'
              ? desktopClassName
              : mobileClassName
          }
          href={item.href}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <NavIcon name={item.icon} />
          {mode === 'desktop' ? (
            <span>{item.label}</span>
          ) : (
            <div className={styles.mobileNavCopy}>
              <strong>{item.label}</strong>
              <span>{item.subtitle}</span>
            </div>
          )}
        </Link>
      </li>
    );
  };
  const renderDesktopNavGroup = (
    label: string,
    icon: NavIconName,
    items: typeof visibleNavItems,
  ) => {
    if (!items.length) {
      return null;
    }

    const isActive = items.some((item) => pathname === item.href);

    return (
      <li className={styles.desktopNavGroup} key={`desktop-group-${label}`}>
        <button
          className={[
            styles.desktopNavLink,
            styles.desktopNavGroupTrigger,
            isActive ? styles.desktopNavLinkActive : null,
          ]
            .filter(Boolean)
            .join(' ')}
          type="button"
        >
          <NavIcon name={icon} />
          <span>{label}</span>
          {/* <span aria-hidden="true" className={styles.desktopNavChevron}>⌄</span> */}
        </button>
        <div className={styles.desktopNavDropdown}>
          {items.map((item) => {
            const itemIsActive = pathname === item.href;
            const isDisabled =
              requiresOnboarding ||
              (item.requiresOperationalMembership && !operationalAccess.hasOperationalMembership);

            if (isDisabled) {
              return (
                <div
                  aria-disabled="true"
                  className={`${styles.desktopDropdownItem} ${styles.desktopDropdownItemDisabled}`}
                  key={`desktop-dropdown-${item.href}`}
                >
                  <NavIcon name={item.icon} />
                  <span>{item.label}</span>
                </div>
              );
            }

            return (
              <Link
                className={[
                  styles.desktopDropdownItem,
                  itemIsActive ? styles.desktopDropdownItemActive : null,
                ]
                  .filter(Boolean)
                  .join(' ')}
                href={item.href}
                key={`desktop-dropdown-${item.href}`}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </li>
    );
  };

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <span aria-hidden="true" className={styles.topbarGlow} />
        <div className={styles.topbarLeft}>
          <button
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
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
            <NavbarLogo logoUrl={COMPANY_LOGO_URL} />
          </Link>
        </div>

        <nav aria-label="Principal" className={styles.desktopNav}>
          <ul className={styles.desktopNavList}>
            {desktopPrimaryItems.map((item) => renderNavItem(item, 'desktop'))}
            {renderDesktopNavGroup('Conductor', 'driver', desktopDriverItems)}
            {renderDesktopNavGroup('Admin', 'settings', desktopAdminItems)}
          </ul>
        </nav>

        <div className={styles.topbarRight}>
          <NotificationBell accessToken={authSession?.accessToken} />

          <div className={styles.userMenuWrap} ref={userMenuRef}>
            <button
              aria-expanded={isUserMenuOpen}
              aria-label="Abrir menú de usuario"
              className={styles.userMenuTrigger}
              onClick={() => setIsUserMenuOpen((currentValue) => !currentValue)}
              type="button"
            >
              <span className={styles.userMenuIdentity}>
                <strong>{displayName}</strong>
              </span>
              <span className={styles.userMenuAvatar} aria-hidden="true">
                {authSession?.user.profilePhotoUrl ? (
                  <img
                    alt=""
                    className={styles.userMenuAvatarImage}
                    src={authSession.user.profilePhotoUrl}
                  />
                ) : (
                  userInitials
                )}
              </span>
            </button>

            {isUserMenuOpen ? (
              <div className={styles.userMenuDropdown}>
                <div className={styles.dropdownHeader}>
                  <strong className={styles.dropdownHeaderName}>{authSession?.user.fullName}</strong>
                  <span className={styles.dropdownHeaderEmail}>{authSession?.user.email}</span>
                </div>
                <Link
                  className={styles.dropdownItem}
                  href="/perfil"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <svg className={styles.dropdownIcon} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Mi perfil
                </Link>
                {!isAdminWorkspace ? (
                  <button
                    className={styles.dropdownItem}
                    onClick={handleDriverEntry}
                    type="button"
                  >
                    <svg className={styles.dropdownIcon} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 15h14l-1.1-5H6.1L5 15Z" />
                      <circle cx="8.5" cy="16.8" r="1.4" />
                      <circle cx="15.5" cy="16.8" r="1.4" />
                      <path d="M6.2 10 8 6.8h8L17.8 10" />
                    </svg>
                    Ser Conductor
                  </button>
                ) : null}
                <button
                  className={styles.dropdownItemDanger}
                  onClick={handleSignOut}
                  type="button"
                >
                  <svg className={styles.dropdownIconDanger} fill="none" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div
        aria-hidden={!isMobileMenuOpen}
        className={styles.mobileBackdrop}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside
        className={[
          styles.mobileDrawer,
          isMobileMenuOpen ? styles.mobileDrawerOpen : null,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.mobileProfileCard}>
          <div className={styles.userAvatar}>
            {authSession?.user.profilePhotoUrl ? (
              <img
                alt=""
                className={styles.userAvatarImage}
                src={authSession.user.profilePhotoUrl}
              />
            ) : (
              <span className={styles.userAvatarFallback}>{userInitials}</span>
            )}
          </div>
          <div className={styles.mobileProfileCopy}>
            <strong>{authSession?.user.fullName ?? 'Usuario'}</strong>
            <p>{currentMembership?.institutionName ?? 'Sin institución'}</p>
          </div>
        </div>

        <nav aria-label="Navegación móvil" className={styles.mobileNav}>
          <ul className={styles.mobileNavList}>
            {visibleNavItems.map((item) => renderNavItem(item, 'mobile'))}
            <li>
              <Link
                className={
                  [
                    styles.mobileNavLink,
                    pathname === '/perfil' ? styles.mobileNavLinkActive : null,
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
                href="/perfil"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <NavIcon name="profile" />
                <div className={styles.mobileNavCopy}>
                  <strong>Perfil</strong>
                  <span>Mi cuenta</span>
                </div>
              </Link>
            </li>
            {!isAdminWorkspace ? (
              <li>
                <button
                  className={styles.mobileNavButton}
                  onClick={handleDriverEntry}
                  type="button"
                >
                  <NavIcon name="driver" />
                  <div className={styles.mobileNavCopy}>
                    <strong>Conductor</strong>
                    <span>
                      {isApprovedDriver || hasStartedDriverFlow
                        ? 'Gestionar estado'
                        : 'Iniciar proceso'}
                    </span>
                  </div>
                </button>
              </li>
            ) : null}
          </ul>

          {!operationalAccess.hasOperationalMembership && operationalAccess.title && operationalAccess.message ? (
            <div className={styles.noteCard}>
              <p className={styles.noteLabel}>Acceso limitado</p>
              <strong>{operationalAccess.title}</strong>
              <p>{operationalAccess.message}</p>
            </div>
          ) : null}

          {requiresOnboarding ? (
            <div className={styles.noteCard}>
              <p className={styles.noteLabel}>Perfil pendiente</p>
              <strong>Completa tu perfil para continuar.</strong>
            </div>
          ) : null}
        </nav>

        <div className={styles.mobileDrawerFooter}>
          <NotificationBell accessToken={authSession?.accessToken} />
          <button
            className={styles.mobileSignOut}
            onClick={handleSignOut}
            type="button"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className={styles.content}>{children}</main>

      {!isAdminWorkspace && hasStartedDriverFlow ? (
        <button
          aria-label={
            isDriverExperienceActive
              ? 'Cambiar a modo pasajero'
              : 'Cambiar a modo conductor'
          }
          className={`${styles.experienceFab} ${
            isDriverExperienceActive ? styles.experienceFabToPassenger : styles.experienceFabToDriver
          }`}
          onClick={() => {
            const nextMode = isDriverExperienceActive ? 'passenger' : 'driver';

            setExperienceMode(nextMode);

            if (nextMode === 'driver' && hasPendingApprovalReminder) {
              persistToast({
                title: 'Solicitud en revision',
                description: 'Tu solicitud para ser conductor aun no ha sido aprobada. Te avisaremos cuando haya una respuesta.',
                tone: 'info',
              });
            }
          }}
          type="button"
        >
          <span className={styles.experienceFabIcon} aria-hidden="true">
            {isDriverExperienceActive ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 15h14l-1.1-5H6.1L5 15Z" />
                <circle cx="8.5" cy="16.8" r="1.4" />
                <circle cx="15.5" cy="16.8" r="1.4" />
                <path d="M6.2 10 8 6.8h8L17.8 10" />
              </svg>
            )}
          </span>
          <span className={styles.experienceFabCopy}>
            <small>Cambiar a</small>
            <strong>{isDriverExperienceActive ? 'Pasajero' : 'Conductor'}</strong>
          </span>
        </button>
      ) : null}

      {isDriverPromptOpen ? (
        <div className={styles.modalOverlay} role="presentation">
          <div
            aria-labelledby="driver-prompt-title"
            aria-modal="true"
            className={styles.modalCard}
            role="dialog"
          >
            <div className={styles.modalCopy}>
              <p className={styles.modalEyebrow}>Conductor</p>
              <h2 id="driver-prompt-title" className={styles.modalTitle}>
                Iniciar el proceso para ser conductor
              </h2>
              <p className={styles.modalText}>
                Te llevaremos al formulario donde podras enviar tus datos y documentos para revision.
              </p>
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.modalSecondaryButton}
                onClick={() => setIsDriverPromptOpen(false)}
                type="button"
              >
                Ahora no
              </button>
              <button
                className={styles.modalPrimaryButton}
                onClick={() => {
                  setIsDriverPromptOpen(false);
                  setExperienceMode('driver');
                  router.push('/conductor');
                }}
                type="button"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
