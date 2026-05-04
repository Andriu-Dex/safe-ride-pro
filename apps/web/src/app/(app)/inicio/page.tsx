'use client';

import {
  DriverVerificationStatus,
  InstitutionMembershipRole,
} from '@saferidepro/shared-types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { ApiError } from '../../../lib/api-client';
import { canAccessAudit } from '../../../modules/audit/lib/audit-access';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import {
  canAccessDashboard,
  canAccessDriverTools,
} from '../../../modules/auth/lib/app-access';
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
import styles from './page.module.css';

type HomeAction = {
  title: string;
  subtitle: string;
  href: string;
  icon: 'trip' | 'driver' | 'trust' | 'dashboard' | 'profile';
};

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

function hasDriverProcess(status?: DriverVerificationStatus | null): boolean {
  return status != null && status !== DriverVerificationStatus.NotRequested;
}

function getPrimaryAction({
  isAdminWorkspace,
  hasOperationalMembership,
  driverLicenseMessage,
  hasRestrictions,
  hasDriverTools,
}: {
  isAdminWorkspace: boolean;
  hasOperationalMembership: boolean;
  driverLicenseMessage: string | null;
  hasRestrictions: boolean;
  hasDriverTools: boolean;
}) {
  if (isAdminWorkspace) {
    return {
      title: 'Supervisa aprobaciones, reportes y trazabilidad administrativa.',
      href: '/auditoria',
      label: 'Abrir auditoria',
    };
  }

  if (!hasOperationalMembership) {
    return {
      title: 'Completa tu perfil para activar tu contexto institucional.',
      href: '/perfil',
      label: 'Completar perfil',
    };
  }

  if (driverLicenseMessage) {
    return {
      title: 'Tu habilitacion de conductor necesita atencion.',
      href: '/conductor',
      label: 'Revisar conductor',
    };
  }

  if (hasRestrictions) {
    return {
      title: 'Tu estado de confianza requiere revision.',
      href: '/confianza',
      label: 'Ver confianza',
    };
  }

  if (hasDriverTools) {
    return {
      title: 'Todo listo para publicar o gestionar viajes.',
      href: '/viajes',
      label: 'Abrir viajes',
    };
  }

  return {
    title: 'Explora viajes y solicita tu proximo trayecto.',
    href: '/viajes',
    label: 'Ver viajes',
  };
}

export default function HomePage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const auditVisible = canAccessAudit(authSession?.user);
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const currentMembership =
    operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const loadHome = async (accessToken: string) => {
    if (auditVisible || !operationalAccess.hasOperationalMembership) {
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
        pushToast('Inicio actualizado', 'La informacion ya esta al dia.', 'success');
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
  }, [auditVisible, authSession, isHydrated, operationalAccess.hasOperationalMembership, refreshSession]);

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
  const hasDriverTools = canAccessDriverTools(authSession?.user);
  const dashboardVisible = canAccessDashboard(authSession?.user);
  const isAdminWorkspace = auditVisible;
  const hasRestrictions =
    restrictions.blocksPassenger ||
    restrictions.blocksDriver ||
    Boolean(restrictions.message);

  const primaryAction = getPrimaryAction({
    isAdminWorkspace,
    hasOperationalMembership: operationalAccess.hasOperationalMembership,
    driverLicenseMessage,
    hasRestrictions,
    hasDriverTools,
  });

  const quickActions = useMemo<HomeAction[]>(
    () => {
      if (isAdminWorkspace) {
        return [
          {
            title: 'Moderacion',
            subtitle: 'Gestion',
            href: '/moderacion',
            icon: 'dashboard',
          },
          {
            title: 'Dashboard',
            subtitle: 'Control',
            href: '/dashboard',
            icon: 'trust',
          },
          {
            title: 'Usuarios',
            subtitle: 'Cuentas',
            href: '/usuarios',
            icon: 'profile',
          },
          {
            title: 'Perfil',
            subtitle: 'Cuenta',
            href: '/perfil',
            icon: 'profile',
          },
        ];
      }

      return [
        {
          title: 'Viajes',
          subtitle: hasDriverTools ? 'Movilidad' : 'Explorar',
          href: '/viajes',
          icon: 'trip',
        },
        ...(hasDriverTools
          ? [
              {
                title: 'Conductor',
                subtitle: 'Operacion',
                href: '/conductor',
                icon: 'driver' as const,
              },
            ]
          : []),
        {
          title: 'Confianza',
          subtitle: 'Estado',
          href: '/confianza',
          icon: 'trust',
        },
        ...(dashboardVisible
          ? [
              {
                title: 'Dashboard',
                subtitle: 'Resumen',
                href: '/dashboard',
                icon: 'dashboard' as const,
              },
            ]
          : []),
        {
          title: 'Perfil',
          subtitle: 'Cuenta',
          href: '/perfil',
          icon: 'profile',
        },
      ];
    },
    [dashboardVisible, hasDriverTools, isAdminWorkspace],
  );

  const contextRows = isAdminWorkspace
    ? [
        {
          label: 'Acceso',
          value: 'Administrativo',
        },
        {
          label: 'Instituciones',
          value: String(
            authSession?.user.memberships.filter(
              (membership) => membership.role === InstitutionMembershipRole.InstitutionAdmin,
            ).length ?? 0,
          ),
        },
        {
          label: 'Correo',
          value: authSession?.user.email ?? 'Pendiente',
        },
        {
          label: 'Rol',
          value: getMembershipRoleLabel(currentMembership?.role),
        },
      ]
    : [
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

  const activeNotice = isAdminWorkspace
    ? null
    : restrictions.message
    ? {
        title: 'Revisa tu estado de confianza',
        description: restrictions.message,
        href: '/confianza',
        label: 'Abrir confianza',
      }
    : !operationalAccess.hasOperationalMembership
      ? {
          title: 'Tu cuenta aun no tiene contexto operativo',
          description: operationalAccess.message ?? 'Completa tu perfil para continuar.',
          href: '/perfil',
          label: 'Ir a perfil',
        }
      : driverLicenseMessage
        ? {
            title: 'Tu habilitacion de conductor requiere atencion',
            description: driverLicenseMessage,
            href: '/conductor',
            label: 'Revisar conductor',
          }
        : null;

  if (isLoading) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.loadingShell}>
          <article className={styles.loadingCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.loadingTitle}>Cargando inicio</h1>
            <p className={styles.loadingText}>Estamos preparando tu espacio principal.</p>
          </article>
        </section>
      </>
    );
  }

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <div className={styles.pageShell}>
        <main className={styles.surface}>
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Inicio</p>
              <h1 className={styles.heroTitle}>Hola, {displayName}</h1>
              <p className={styles.heroLead}>
                {isAdminWorkspace
                  ? 'Accede a tus herramientas de gestion y mantén el control institucional desde una sola vista.'
                  : hasDriverTools
                    ? 'Gestiona tus viajes y revisa tu estado actual desde un solo panel.'
                    : 'Accede a tus opciones principales y revisa tu estado actual.'}
              </p>
            </div>

            <div className={styles.heroActions}>
              <Link className={styles.primaryLink} href={primaryAction.href}>
                {primaryAction.label}
              </Link>
              <button
                className={styles.secondaryButton}
                disabled={isRefreshing}
                onClick={() => void refreshHome(true)}
                type="button"
              >
                {isRefreshing ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          </section>

          {activeNotice ? (
            <section className={styles.noticeBand}>
              <div className={styles.noticeCopy}>
                <strong>{activeNotice.title}</strong>
                <p>{activeNotice.description}</p>
              </div>
              <Link className={styles.noticeLink} href={activeNotice.href}>
                {activeNotice.label}
              </Link>
            </section>
          ) : null}

          <section className={styles.actionPanel}>
            <div className={styles.actionGrid}>
              {quickActions.map((action) => (
                <Link className={styles.actionItem} href={action.href} key={action.href}>
                  <span className={styles.actionIcon} aria-hidden="true">
                    <ActionIcon name={action.icon} />
                  </span>
                  <div className={styles.actionText}>
                    <strong>{action.title}</strong>
                    <span>{action.subtitle}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className={styles.contextPanel}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>Contexto</p>
                <h2>{isAdminWorkspace ? 'Alcance administrativo' : 'Tu estado actual'}</h2>
              </div>
              {auditVisible ? (
                <Link className={styles.inlineLink} href="/auditoria">
                  Ir a auditoria
                </Link>
              ) : null}
            </div>

            <div className={styles.contextGrid}>
              {contextRows.map((item) => (
                <div className={styles.contextRow} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

function ActionIcon({ name }: { name: HomeAction['icon'] }) {
  switch (name) {
    case 'trip':
      return (
        <svg fill="none" viewBox="0 0 24 24">
          <path d="M9 20 4 17.5V6.5L9 9m0 11 6-3m-6 3V9m6 8 5 2.5V6.5L15 4m0 13V4m0 0L9 9" />
        </svg>
      );
    case 'driver':
      return (
        <svg fill="none" viewBox="0 0 24 24">
          <path d="M5 15h14l-1.1-5H6.1L5 15Z" />
          <circle cx="8.5" cy="16.8" r="1.4" />
          <circle cx="15.5" cy="16.8" r="1.4" />
          <path d="M6.2 10 8 6.8h8L17.8 10" />
        </svg>
      );
    case 'trust':
      return (
        <svg fill="none" viewBox="0 0 24 24">
          <path d="M12 4 5 7v4.8c0 4.4 2.8 7.6 7 8.9 4.2-1.3 7-4.5 7-8.9V7l-7-3Z" />
          <path d="m9 12.2 2 2 4-4" />
        </svg>
      );
    case 'dashboard':
      return (
        <svg fill="none" viewBox="0 0 24 24">
          <rect x="4" y="4" width="7" height="7" rx="1.2" />
          <rect x="13" y="4" width="7" height="4.5" rx="1.2" />
          <rect x="13" y="10.5" width="7" height="9.5" rx="1.2" />
          <rect x="4" y="13" width="7" height="7" rx="1.2" />
        </svg>
      );
    case 'profile':
      return (
        <svg fill="none" viewBox="0 0 24 24">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return null;
  }
}
