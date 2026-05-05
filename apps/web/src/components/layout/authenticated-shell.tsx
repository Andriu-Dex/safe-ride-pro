'use client';

import { DriverVerificationStatus } from '@saferidepro/shared-types';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { canAccessAudit } from '../../modules/audit/lib/audit-access';
import { useAuth } from '../../modules/auth/hooks/use-auth';
import { canAccessDashboard, canAccessDriverTools } from '../../modules/auth/lib/app-access';
import { getOperationalAccessState } from '../../modules/auth/lib/operational-context';
import { NotificationBell } from '../../modules/notifications/components/notification-bell';
import { getUserInitials } from '../../modules/users/lib/get-user-initials';
import { NavbarLogo } from '../ui/navbar-logo';
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
    audience: 'driver',
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
  const iconClass = "w-5 h-5 stroke-current fill-none";
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
  const isApprovedDriver = canAccessDriverTools(authSession?.user);
  const dashboardVisible = canAccessDashboard(authSession?.user);
  const isAdminWorkspace = auditVisible;
  const effectiveDriverStatus =
    currentMembership?.effectiveDriverVerificationStatus
    ?? currentMembership?.driverVerificationStatus
    ?? DriverVerificationStatus.NotRequested;
  const hasStartedDriverFlow = effectiveDriverStatus !== DriverVerificationStatus.NotRequested;

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

        if (item.audience === 'driver') {
          return isApprovedDriver;
        }

        if (item.audience === 'dashboard') {
          return dashboardVisible;
        }

        return true;
      });
    },
    [auditVisible, dashboardVisible, isAdminWorkspace, isApprovedDriver],
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

    if (isDisabled) {
      return (
        <li key={`${mode}-${item.href}`} aria-disabled="true">
          <div
            className={
              mode === 'desktop'
                ? 'flex items-center gap-2 px-3 py-2.5 rounded-xl text-base font-semibold text-teal-100/40 cursor-not-allowed'
                : 'flex items-center gap-4 px-4 py-3.5 rounded-2xl text-slate-400 opacity-50 cursor-not-allowed bg-slate-50/50'
            }
          >
            <NavIcon name={item.icon} />
            {mode === 'desktop' ? (
              <span className="whitespace-nowrap">{item.label}</span>
            ) : (
              <div className="flex flex-col">
                <strong className="text-lg font-bold">{item.label}</strong>
                <span className="text-sm font-medium">{item.subtitle}</span>
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
              ? `flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-base transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'bg-teal-800/80 text-white font-bold shadow-sm ring-1 ring-teal-700/50'
                    : 'text-teal-100/70 font-semibold hover:bg-white/10 hover:text-white'
                }`
              : `flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 active:scale-[0.98] ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 border border-teal-100 shadow-sm'
                    : 'text-slate-600 font-semibold hover:bg-slate-50 hover:text-teal-700 border border-transparent'
                }`
          }
          href={item.href}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <NavIcon name={item.icon} />
          {mode === 'desktop' ? (
            <span className="whitespace-nowrap">{item.label}</span>
          ) : (
            <div className="flex flex-col">
              <strong className={`text-lg ${isActive ? 'font-bold' : 'font-semibold'}`}>{item.label}</strong>
              <span className={`text-sm ${isActive ? 'font-semibold text-teal-600/80' : 'font-medium opacity-70'}`}>{item.subtitle}</span>
            </div>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* CABECERA (ESCRITORIO Y MÓVIL) */}
      <header className="sticky top-0 z-40 bg-teal-950 text-white border-b border-teal-900 shadow-md">
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-16 lg:h-20 transition-all duration-300 relative">
            
            {/* Izquierda: Menú móvil y Logo */}
            <div className="flex items-center gap-2 sm:gap-4 z-20">
              <button
                aria-expanded={isMobileMenuOpen}
                aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
                className="lg:hidden p-2 rounded-xl text-teal-100 hover:bg-white/10 hover:text-white transition-colors focus:outline-none"
                onClick={() => setIsMobileMenuOpen((currentValue) => !currentValue)}
                type="button"
              >
                <svg aria-hidden="true" className="w-6 h-6 stroke-current fill-none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
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

              <Link className="flex items-center group outline-none hover:opacity-80 transition-opacity" href="/inicio">
                <NavbarLogo logoUrl={COMPANY_LOGO_URL} />
              </Link>
            </div>

            {/* Centro Absoluto: Navegación de Escritorio */}
            <nav aria-label="Principal" className="hidden lg:flex items-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-max">
              <ul className="flex items-center gap-1 m-0 p-0 list-none">
                {visibleNavItems.map((item) => renderNavItem(item, 'desktop'))}
              </ul>
            </nav>

            {/* Derecha: Notificaciones y Perfil */}
            <div className="flex items-center gap-2 sm:gap-4 z-20">
              <div className="text-teal-100 hover:text-white transition-colors">
                <NotificationBell accessToken={authSession?.accessToken} />
              </div>

              <div className="relative flex items-center" ref={userMenuRef}>
                <button
                  aria-expanded={isUserMenuOpen}
                  aria-label="Abrir menú de usuario"
                  className={`${styles.userProfileButton} group`}
                  onClick={() => setIsUserMenuOpen((currentValue) => !currentValue)}
                  type="button"
                >
                  <div className="hidden sm:block text-right">
                    <strong className="block text-base font-bold text-white leading-none group-hover:text-teal-100 transition-colors">{displayName}</strong>
                  </div>

                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center text-sm font-bold shadow-inner border border-teal-500 group-hover:shadow-teal-400/50 group-hover:scale-105 transition-all duration-200" aria-hidden="true">
                    {authSession?.user.profilePhotoUrl ? (
                      <img
                        alt=""
                        className="w-full h-full rounded-xl object-cover"
                        src={authSession.user.profilePhotoUrl}
                      />
                    ) : (
                      <span>{userInitials}</span>
                    )}
                  </div>
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
                        Conductor
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
          </div>
        </div>
      </header>

      {/* FONDO OSCURO DEL MENÚ MÓVIL */}
      <div
        aria-hidden={!isMobileMenuOpen}
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* CAJÓN DEL MENÚ MÓVIL */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-xs bg-white shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Cabecera de Perfil Móvil */}
        <div className="p-6 bg-linear-to-b from-slate-50 to-white border-b border-slate-100 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-inner border border-teal-700/50">
            {authSession?.user.profilePhotoUrl ? (
              <img alt="" className="w-full h-full rounded-2xl object-cover" src={authSession.user.profilePhotoUrl} />
            ) : (
              <span>{userInitials}</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <strong className="text-slate-900 font-bold truncate text-lg">{authSession?.user.fullName}</strong>
            <span className="text-slate-500 text-sm truncate font-medium">{currentMembership?.institutionName ?? 'Sin institución'}</span>
          </div>
        </div>

        {/* Navegación Móvil */}
        <nav aria-label="Navegación móvil" className="flex-1 overflow-y-auto p-4 space-y-2">
          <ul className="m-0 p-0 list-none space-y-2">
            {visibleNavItems.map((item) => renderNavItem(item, 'mobile'))}
            
            <li className="pt-4 mt-4 border-t border-slate-100">
              <Link
                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 ${
                  pathname === '/perfil'
                    ? 'bg-teal-50 text-teal-700 border border-teal-100 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-teal-700 border border-transparent'
                }`}
                href="/perfil"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                 <svg className="w-5 h-5 stroke-current fill-none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                   <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                   <circle cx="12" cy="7" r="4"></circle>
                 </svg>
                <div className="flex flex-col">
                  <strong className={`text-lg ${pathname === '/perfil' ? 'font-bold' : 'font-semibold'}`}>Perfil</strong>
                  <span className={`text-sm ${pathname === '/perfil' ? 'font-semibold text-teal-600/80' : 'font-medium opacity-70'}`}>Mi cuenta</span>
                </div>
              </Link>
            </li>
            {!isAdminWorkspace ? (
              <li>
                <button
                  className="flex w-full items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 text-slate-600 hover:bg-slate-50 hover:text-teal-700 border border-transparent"
                  onClick={handleDriverEntry}
                  type="button"
                >
                  <svg className="w-5 h-5 stroke-current fill-none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M5 15h14l-1.1-5H6.1L5 15Z"></path>
                    <circle cx="8.5" cy="16.8" r="1.4"></circle>
                    <circle cx="15.5" cy="16.8" r="1.4"></circle>
                    <path d="M6.2 10 8 6.8h8L17.8 10"></path>
                  </svg>
                  <div className="flex flex-col">
                    <strong className="text-lg font-semibold">Conductor</strong>
                    <span className="text-sm font-medium opacity-70">
                      {isApprovedDriver || hasStartedDriverFlow ? 'Gestionar estado' : 'Iniciar proceso'}
                    </span>
                  </div>
                </button>
              </li>
            ) : null}
          </ul>

          {/* Alertas */}
          {!operationalAccess.hasOperationalMembership && operationalAccess.title && operationalAccess.message ? (
            <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 shadow-sm">
              <p className="text-amber-800 text-xs font-bold uppercase tracking-wider mb-1">Acceso limitado</p>
              <strong className="text-amber-900 text-sm block mb-1">{operationalAccess.title}</strong>
              <p className="text-amber-700 text-sm leading-relaxed">{operationalAccess.message}</p>
            </div>
          ) : null}

          {requiresOnboarding ? (
            <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 shadow-sm">
              <p className="text-rose-800 text-xs font-bold uppercase tracking-wider mb-1">Perfil pendiente</p>
              <strong className="text-rose-900 text-sm">Completa tu perfil para continuar.</strong>
            </div>
          ) : null}
        </nav>

        {/* Pie de página Móvil */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
          <NotificationBell accessToken={authSession?.accessToken} />
          <button 
            type="button"
            className="px-5 py-2.5 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 font-bold rounded-xl text-sm transition-all shadow-sm active:scale-95"
            onClick={handleSignOut}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 w-full relative">
        {children}
      </main>

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
