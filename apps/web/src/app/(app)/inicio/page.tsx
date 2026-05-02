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
import styles from './page.module.css';

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
        <section className={styles.loadingShell}>
          <article className={styles.loadingCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.loadingTitle}>Cargando inicio</h1>
          </article>
        </section>
      </>
    );
  }

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <section className={styles.homeShell}>
        <section className={`${styles.hero} ${styles.reveal}`}>
          <div className={styles.heroBackdrop} aria-hidden="true" />

          <div className={styles.heroHeader}>
            <div>
              <p className={styles.eyebrow}>Inicio</p>
              <h1 className={styles.heroTitle}>Hola, {displayName}</h1>
            </div>

            <Button
              disabled={isRefreshing}
              onClick={() => void refreshHome(true)}
              variant="secondary"
            >
              {isRefreshing ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>

          <div className={styles.heroBody}>
            <div className={styles.heroPrimary}>
              <div className={styles.heroStatement}>
                <span className={styles.heroStatementLabel}>Ahora</span>
                <strong>{primaryAction.title}</strong>
              </div>

              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} href={primaryAction.href}>
                  {primaryAction.label}
                </Link>
                <Link className={styles.secondaryButton} href="/dashboard">
                  Dashboard
                </Link>
              </div>
            </div>

            <div className={styles.heroGrid}>
              {statusItems.map((item) => (
                <article className={styles.statusTile} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
          </div>
        </section>

        {activeIssue ? (
          <Link className={`${styles.issueBanner} ${styles.reveal}`} href={activeIssue.href}>
            <span>Atencion</span>
            <strong>{activeIssue.title}</strong>
          </Link>
        ) : null}

        <section className={`${styles.board} ${styles.reveal}`}>
          <div className={styles.boardMain}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Accesos</p>
              <h2>Abre lo que necesitas</h2>
            </div>

            <div className={styles.quickActionGrid}>
              {quickActions.map((action) => (
                <Link className={styles.quickAction} href={action.href} key={action.href}>
                  <strong>{action.title}</strong>
                  <span>Abrir</span>
                </Link>
              ))}
            </div>
          </div>

          <aside className={styles.boardSide}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Resumen</p>
              <h2>Tu cuenta</h2>
            </div>

            <div className={styles.spotlightList}>
              {spotlightItems.map((item) => (
                <div className={styles.spotlightRow} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            <div className={styles.sideActions}>
              <Link className={styles.textLink} href="/perfil">
                Editar perfil
              </Link>
              {auditVisible ? (
                <Link className={styles.textLink} href="/auditoria">
                  Auditoria
                </Link>
              ) : null}
            </div>
          </aside>
        </section>
      </section>
    </>
  );
}
