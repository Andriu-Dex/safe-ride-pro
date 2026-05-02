'use client';

import {
  DriverVerificationStatus,
  InstitutionMembershipRole,
} from '@saferidepro/shared-types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { ApiError } from '../../../lib/api-client';
import { canAccessAudit } from '../../../modules/audit/lib/audit-access';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../modules/auth/lib/operational-context';
import {
  getDriverLicenseAlertMessage,
  getDriverLicenseStatusLabel,
  getDriverStatusLabel,
} from '../../../modules/driver/lib/driver-status';
import { getCurrentUserTrustSummary } from '../../../modules/users/lib/user-api';
import {
  getAdministrativeRiskStateLabel,
  getTrustRestrictions,
} from '../../../modules/users/lib/trust-labels';
import type { TrustSummary } from '../../../modules/users/types/trust-summary';

function getMembershipRoleLabel(role?: InstitutionMembershipRole): string {
  switch (role) {
    case InstitutionMembershipRole.InstitutionAdmin:
      return 'Administrador institucional';
    case InstitutionMembershipRole.Student:
      return 'Estudiante';
    default:
      return 'Sin rol institucional';
  }
}

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

function getPreferredDisplayName(fullName?: string): string {
  if (!fullName) {
    return 'usuario';
  }

  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function getPrimaryAction(hasOperationalMembership: boolean, driverLicenseMessage: string | null, hasRestrictions: boolean) {
  if (!hasOperationalMembership) {
    return {
      title: 'Completa tu perfil',
      href: '/perfil',
      label: 'Completar perfil',
    };
  }

  if (driverLicenseMessage) {
    return {
      title: 'Revisa tu habilitacion',
      href: '/conductor',
      label: 'Abrir conductor',
    };
  }

  if (hasRestrictions) {
    return {
      title: 'Revisa tu estado',
      href: '/confianza',
      label: 'Ver confianza',
    };
  }

  return {
    title: 'Todo listo',
    href: '/viajes',
    label: 'Abrir viajes',
  };
}

function isApprovedDriver(status?: DriverVerificationStatus | null): boolean {
  return status === DriverVerificationStatus.Approved;
}

function hasDriverProcess(status?: DriverVerificationStatus | null): boolean {
  return status != null && status !== DriverVerificationStatus.NotRequested;
}

function getBadgeColor(val: string): string {
  const v = val.toLowerCase();
  if (v.includes('operativa') || v.includes('aprobado') || v.includes('vigente') || v.includes('sin riesgo')) return 'bg-emerald-100 text-emerald-800';
  if (v.includes('pendiente') || v.includes('revisión') || v.includes('revision') || v.includes('observación') || v.includes('observacion')) return 'bg-amber-100 text-amber-800';
  if (v.includes('rechazado') || v.includes('bloqueado') || v.includes('vencid') || v.includes('suspendido')) return 'bg-rose-100 text-rose-800';
  return 'bg-slate-100 text-slate-700';
}

function getActionIcon(href: string) {
  if (href.includes('viajes')) {
    return (
      <svg className="w-8 h-8 text-teal-500 mb-3 group-hover:scale-110 group-hover:text-teal-600 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    );
  }
  if (href.includes('conductor')) {
    return (
      <svg className="w-8 h-8 text-teal-500 mb-3 group-hover:scale-110 group-hover:text-teal-600 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3m-3 3h3m-3 3h3m-6 1c-.306-.613-.933-1-1.618-1H7.618c-.685 0-1.312.387-1.618 1M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
      </svg>
    );
  }
  if (href.includes('confianza')) {
    return (
      <svg className="w-8 h-8 text-teal-500 mb-3 group-hover:scale-110 group-hover:text-teal-600 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    );
  }
  if (href.includes('dashboard')) {
    return (
      <svg className="w-8 h-8 text-teal-500 mb-3 group-hover:scale-110 group-hover:text-teal-600 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    );
  }
  if (href.includes('perfil')) {
    return (
      <svg className="w-8 h-8 text-teal-500 mb-3 group-hover:scale-110 group-hover:text-teal-600 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    );
  }
  return null;
}

export default function HomePage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const currentMembership =
    operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const loadHome = async (accessToken: string) => {
    if (!operationalAccess.hasOperationalMembership) {
      setTrustSummary(null);
      return;
    }

    const trustSummaryData = await getCurrentUserTrustSummary(accessToken);
    setTrustSummary(trustSummaryData);
  };

  const pushToast = (title: string, description: string, tone: ToastItem['tone'] = 'info') => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `home-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  };

  const refreshHome = async (showSpinner = false) => {
    if (!authSession) {
      return;
    }

    if (showSpinner) {
      setIsRefreshing(true);
    }

    try {
      await loadHome(authSession.accessToken);

      if (showSpinner) {
        pushToast('Inicio actualizado', 'Listo.', 'success');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible sincronizar la pantalla de inicio.'),
      );
    } finally {
      if (showSpinner) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await loadHome(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        setErrorMessage(
          getApiErrorMessage(error, 'No fue posible cargar la pantalla de inicio.'),
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [authSession, isHydrated, operationalAccess.hasOperationalMembership, refreshSession]);

  useAutoRefresh(
    async () => {
      await refreshHome();
    },
    {
      enabled: Boolean(authSession),
      intervalMs: 30000,
    },
  );

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    pushToast('No se pudo cargar', errorMessage, 'error');
    setErrorMessage(null);
  }, [errorMessage]);

  const restrictions = getTrustRestrictions(trustSummary);
  const effectiveDriverStatus =
    currentMembership?.effectiveDriverVerificationStatus ??
    currentMembership?.driverVerificationStatus;
  const isDriverFlowActive = hasDriverProcess(effectiveDriverStatus);
  const driverLicenseMessage = isDriverFlowActive
    ? getDriverLicenseAlertMessage(
        currentMembership?.licenseStatus,
        currentMembership?.licenseExpiresInDays,
      )
    : null;
  const displayName = getPreferredDisplayName(authSession?.user.fullName);
  const auditVisible = canAccessAudit(authSession?.user);
  const hasRestrictions =
    restrictions.blocksPassenger ||
    restrictions.blocksDriver ||
    Boolean(restrictions.message);

  const primaryAction = getPrimaryAction(
    operationalAccess.hasOperationalMembership,
    driverLicenseMessage,
    hasRestrictions,
  );

  const quickActions = [
    { title: 'Viajes', href: '/viajes' },
    {
      title: isApprovedDriver(
        currentMembership?.effectiveDriverVerificationStatus ??
          currentMembership?.driverVerificationStatus,
      )
        ? 'Conductor'
        : 'Ser conductor',
      href: '/conductor',
    },
    { title: 'Confianza', href: '/confianza' },
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Perfil', href: '/perfil' },
  ];

  const statusItems = [
    {
      label: 'Cuenta',
      value: operationalAccess.hasOperationalMembership ? 'Operativa' : 'Pendiente',
    },
    {
      label: 'Conductor',
      value: currentMembership
        ? getDriverStatusLabel(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
        : 'Pendiente',
    },
    {
      label: 'Licencia',
      value: isDriverFlowActive
        ? getDriverLicenseStatusLabel(currentMembership?.licenseStatus)
        : 'No aplica',
    },
    {
      label: 'Confianza',
      value: trustSummary
        ? getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)
        : 'Pendiente',
    },
  ];

  const spotlightItems = [
    {
      label: 'Institucion',
      value: currentMembership?.institutionName ?? 'Pendiente',
    },
    {
      label: 'Rol',
      value: getMembershipRoleLabel(currentMembership?.role),
    },
    {
      label: 'Correo',
      value: authSession?.user.email ?? 'Pendiente',
    },
    {
      label: 'Interacciones',
      value: trustSummary ? String(trustSummary.completedInteractions) : '0',
    },
  ];

  const activeIssue = restrictions.message
    ? {
        title: restrictions.message,
        href: '/confianza',
      }
    : !operationalAccess.hasOperationalMembership
      ? {
          title: 'Activa tu contexto institucional.',
          href: '/perfil',
        }
      : driverLicenseMessage
        ? {
            title: driverLicenseMessage,
            href: '/conductor',
          }
        : null;

  if (isLoading) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">Cargando tu espacio...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <div className="min-h-screen bg-slate-50 pb-12">
        {/* CABECERA OSCURA - ALTO CONTRASTE */}
        <header className="bg-teal-950 pt-8 sm:pt-10 pb-28 sm:pb-32 px-4 sm:px-6 md:px-8">
          <div className="max-w-5xl mx-auto mt-2 sm:mt-4">
            <div className="bg-teal-900 p-6 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
              <div className="flex items-center gap-5">
                <div className="hidden sm:flex shrink-0 w-16 h-16 rounded-full bg-teal-800 items-center justify-center text-2xl font-bold text-teal-100 border-2 border-teal-700 shadow-inner">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-teal-300 font-bold text-sm sm:text-base uppercase tracking-wider mb-2">Bienvenido de vuelta</p>
                  <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">Hola, {displayName}</h1>
                </div>
              </div>
              <button
                disabled={isRefreshing}
                onClick={() => void refreshHome(true)}
                className="text-base font-bold text-teal-950 bg-teal-400 hover:bg-teal-300 transition-colors flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl w-full sm:w-auto"
              >
                {isRefreshing ? 'Actualizando...' : 'Actualizar información'}
              </button>
            </div>
          </div>
        </header>

        {/* DASHBOARD PRINCIPAL SUPERPUESTO */}
        <main className="-mt-12 sm:-mt-16 max-w-5xl mx-auto w-full px-4 sm:px-6 md:px-8 flex flex-col gap-5 sm:gap-6 relative">

          {/* BANNER DE ACCIÓN PRINCIPAL */}
          {activeIssue ? (
            <Link href={activeIssue.href} className="bg-rose-500 hover:bg-rose-600 transition-colors text-white rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 md:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6 group">
              <div>
                <p className="text-rose-100 text-sm sm:text-base font-bold uppercase tracking-wider mb-2">Acción Requerida</p>
                <strong className="text-2xl sm:text-3xl font-extrabold">{activeIssue.title}</strong>
              </div>
              <span className="bg-rose-900 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg whitespace-nowrap text-center group-hover:bg-rose-950 transition-colors w-full sm:w-auto">
                Revisar ahora
              </span>
            </Link>
          ) : (
            <div className="bg-teal-600 text-white rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 md:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
              <div>
                <p className="text-teal-100 text-sm sm:text-base font-bold uppercase tracking-wider mb-2">Estado General</p>
                <strong className="text-2xl sm:text-3xl font-extrabold">{primaryAction.title}</strong>
              </div>
              <Link href={primaryAction.href} className="bg-teal-900 text-white hover:bg-teal-950 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-colors whitespace-nowrap text-center w-full sm:w-auto">
                {primaryAction.label}
              </Link>
            </div>
          )}

          {/* ACCESOS RÁPIDOS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href} className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-500 hover:shadow-teal-500/10 transition-all group flex flex-col justify-between min-h-[120px] sm:min-h-[140px]">
                <div>
                  {getActionIcon(action.href)}
                  <strong className="text-slate-800 text-sm sm:text-lg font-semibold group-hover:text-teal-700 transition-colors line-clamp-2">{action.title}</strong>
                </div>
                <div className="flex justify-end mt-3 sm:mt-4">
                  <div className="bg-slate-50 group-hover:bg-teal-50 p-2 rounded-xl transition-colors">
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* PANELES DE DETALLE (2 COLUMNAS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 mt-2 sm:mt-4">
             <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <h2 className="text-xl font-bold text-slate-800">Resumen de cuenta</h2>
                  <Link href="/perfil" className="text-base font-semibold text-teal-600 hover:text-teal-700 transition-colors">Editar perfil</Link>
                </div>
                <div className="space-y-4 sm:space-y-5">
                  {spotlightItems.map((item) => (
                    <div key={item.label} className="flex justify-between items-center gap-4 pb-4 sm:pb-5 border-b border-slate-100 last:border-0 last:pb-0">
                      <span className="text-slate-500 text-sm sm:text-base">{item.label}</span>
                      <strong className="text-slate-800 text-sm sm:text-base font-semibold text-right break-words">{item.value}</strong>
                    </div>
                  ))}
                </div>
             </section>

             <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <h2 className="text-xl font-bold text-slate-800">Estado operativo</h2>
                  {auditVisible && (
                    <Link href="/auditoria" className="text-base font-semibold text-teal-600 hover:text-teal-700 transition-colors">Auditoría</Link>
                  )}
                </div>
                <div className="space-y-4 sm:space-y-5">
                  {statusItems.map((item) => (
                    <div key={item.label} className="flex justify-between items-center gap-4 pb-4 sm:pb-5 border-b border-slate-100 last:border-0 last:pb-0">
                      <span className="text-slate-500 text-sm sm:text-base">{item.label}</span>
                      <span className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wide text-center ${getBadgeColor(item.value)}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
             </section>
          </div>
        </main>
      </div>
    </>
  );
}
