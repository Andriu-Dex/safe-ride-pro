'use client';

import Link from 'next/link';
import {
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  OperationalSanctionAppealStatus,
  ReportStatus,
} from '@saferidepro/shared-types';
import { useEffect, useMemo, useState } from 'react';

import { StatusPill } from '../../../components/ui/status-pill';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { ApiError } from '../../../lib/api-client';
import { canAccessAudit } from '../../../modules/audit/lib/audit-access';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../modules/auth/lib/operational-context';
import { listReviewableDriverApplications } from '../../../modules/driver/lib/driver-api';
import {
  getDriverLicenseAlertMessage,
  getDriverLicenseStatusLabel,
  getDriverStatusLabel,
  getDriverStatusTone,
} from '../../../modules/driver/lib/driver-status';
import { listReviewableReports } from '../../../modules/reports/lib/report-api';
import { requiresDetailedReviewNote } from '../../../modules/reports/lib/report-labels';
import {
  listReviewableActiveSanctions,
  listReviewableSanctionAppeals,
} from '../../../modules/sanctions/lib/sanction-api';
import { getCurrentUserTrustSummary } from '../../../modules/users/lib/user-api';
import {
  getAdministrativeRiskStateLabel,
  getAdministrativeRiskTone,
  getTrustRestrictions,
  getVisibleReputationStateLabel,
} from '../../../modules/users/lib/trust-labels';
import type { TrustSummary } from '../../../modules/users/types/trust-summary';
import styles from './page.module.css';

type AdminDashboardSummary = {
  pendingDriverApplicationsCount: number;
  openReportsCount: number;
  highSeverityOpenReportsCount: number;
  activeSanctionsCount: number;
  pendingAppealsCount: number;
};

function getGlobalRoleLabel(role: GlobalUserRole): string {
  switch (role) {
    case GlobalUserRole.SuperAdmin:
      return 'Super administrador';
    case GlobalUserRole.User:
      return 'Usuario';
    default:
      return role;
  }
}

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

export default function DashboardPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const currentMembership =
    operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [adminSummary, setAdminSummary] = useState<AdminDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const isAdminWorkspace = canAccessAudit(authSession?.user);

  const pushToast = (
    title: string,
    description: string,
    tone: ToastItem['tone'] = 'info',
  ) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `dashboard-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  };

  const loadDashboard = async (accessToken: string) => {
    if (isAdminWorkspace) {
      const [driverApplications, reports, sanctions, appeals] = await Promise.all([
        listReviewableDriverApplications(accessToken, { limit: 25 }),
        listReviewableReports(accessToken, { limit: 25 }),
        listReviewableActiveSanctions(accessToken, { limit: 25 }),
        listReviewableSanctionAppeals(accessToken, { limit: 25 }),
      ]);

      setAdminSummary({
        pendingDriverApplicationsCount: driverApplications.filter(
          (application) =>
            application.driverVerificationStatus === DriverVerificationStatus.PendingVerification,
        ).length,
        openReportsCount: reports.filter(
          (report) =>
            report.status === ReportStatus.Pending ||
            report.status === ReportStatus.UnderReview,
        ).length,
        highSeverityOpenReportsCount: reports.filter(
          (report) =>
            (report.status === ReportStatus.Pending ||
              report.status === ReportStatus.UnderReview) &&
            requiresDetailedReviewNote(report.reason),
        ).length,
        activeSanctionsCount: sanctions.length,
        pendingAppealsCount: appeals.filter(
          (appeal) => appeal.status === OperationalSanctionAppealStatus.Pending,
        ).length,
      });
      setTrustSummary(null);
      return;
    }

    setAdminSummary(null);

    if (!operationalAccess.hasOperationalMembership) {
      setTrustSummary(null);
      return;
    }

    const trustSummaryData = await getCurrentUserTrustSummary(accessToken);
    setTrustSummary(trustSummaryData);
  };

  const refreshDashboard = async (showSpinner = false) => {
    if (!authSession) {
      return;
    }

    if (showSpinner) {
      setIsRefreshing(true);
    }

    try {
      await loadDashboard(authSession.accessToken);

      if (showSpinner) {
        pushToast('Dashboard actualizado', 'La vista principal ya esta al dia.', 'success');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo actualizar',
        getApiErrorMessage(error, 'No fue posible sincronizar el dashboard.'),
        'error',
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

      try {
        await loadDashboard(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        pushToast(
          'No se pudo cargar',
          getApiErrorMessage(error, 'No fue posible cargar el dashboard.'),
          'error',
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
  }, [authSession, isAdminWorkspace, isHydrated, operationalAccess.hasOperationalMembership, refreshSession]);

  useAutoRefresh(
    async () => {
      await refreshDashboard();
    },
    {
      enabled: Boolean(authSession),
      intervalMs: 30_000,
    },
  );

  const restrictions = getTrustRestrictions(trustSummary);
  const effectiveDriverStatus =
    currentMembership?.effectiveDriverVerificationStatus ??
    currentMembership?.driverVerificationStatus;
  const driverLicenseMessage = getDriverLicenseAlertMessage(
    currentMembership?.licenseStatus,
    currentMembership?.licenseExpiresInDays,
  );
  const roleLabel = getGlobalRoleLabel(authSession?.user.globalRole ?? GlobalUserRole.User);
  const visibleTrustLabel = trustSummary
    ? getVisibleReputationStateLabel(trustSummary.visibleReputationState)
    : 'Pendiente';
  const administrativeRiskLabel = trustSummary
    ? getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)
    : 'Pendiente';

  const adminQueues = useMemo(
    () => [
      {
        title: 'Conductores',
        count: adminSummary?.pendingDriverApplicationsCount ?? 0,
        href: '/moderacion?section=driver',
        note: 'Solicitudes listas para revision',
      },
      {
        title: 'Reportes',
        count: adminSummary?.openReportsCount ?? 0,
        href: '/moderacion?section=reports',
        note: adminSummary?.highSeverityOpenReportsCount
          ? `${adminSummary.highSeverityOpenReportsCount} requieren prioridad`
          : 'Sin casos criticos abiertos',
      },
      {
        title: 'Sanciones',
        count: adminSummary?.activeSanctionsCount ?? 0,
        href: '/moderacion?section=sanctions',
        note: 'Restricciones activas visibles',
      },
      {
        title: 'Apelaciones',
        count: adminSummary?.pendingAppealsCount ?? 0,
        href: '/moderacion?section=appeals',
        note: 'Casos pendientes de decision',
      },
    ],
    [adminSummary],
  );

  const getBadgeClass = (tone: string) => {
    switch (tone) {
      case 'success': return styles.heroBadgeSuccess;
      case 'warning': return styles.heroBadgeWarning;
      case 'danger': return styles.heroBadgeDanger;
      default: return styles.heroBadgeNeutral;
    }
  };

  if (isLoading) {
    return (
      <section className={styles.pageBackground}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <article className={`${styles.canvas} ${styles.canvasSmall}`}>
          <div aria-hidden="true" className={styles.loadingPulse} />
          <h2 className={styles.stateTitle}>Cargando dashboard</h2>
          <p className={styles.stateText}>Preparando la vista principal.</p>
        </article>
      </section>
    );
  }

  return (
    <section className={styles.pageBackground}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <div className={`${styles.canvas} ${styles.revealSoft}`}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Dashboard</p>
              <h1 className={styles.heroTitle}>
                {isAdminWorkspace ? 'Centro administrativo' : 'Vista principal'}
              </h1>
              <p className={styles.heroLead}>
                {isAdminWorkspace
                  ? 'Monitorea la carga de gestion y entra directo a la mesa que necesita decision.'
                  : 'Consulta tu contexto actual y entra rapido a lo que realmente necesitas usar.'}
              </p>
            </div>

            <div className={styles.heroActions}>
              <span className={`${styles.heroBadge} ${getBadgeClass('neutral')}`}>{roleLabel}</span>
              <button
                className={styles.heroBtnGhost}
                disabled={isRefreshing}
                onClick={() => void refreshDashboard(true)}
                type="button"
              >
                {isRefreshing ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          </div>
        </section>

        {isAdminWorkspace ? (
          <div className={styles.mainGrid}>
            <div className={styles.contentColumn}>
              <section className={styles.cardSection}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.kicker}>Resumen</p>
                    <h2>Métricas operativas</h2>
                  </div>
                </div>
                <div className={styles.metricGrid}>
                  <article className={styles.metricCard}>
                    <span>Conductores</span>
                    <strong>{adminSummary?.pendingDriverApplicationsCount ?? 0}</strong>
                    <p className={adminSummary?.pendingDriverApplicationsCount ? styles.metricWarning : styles.metricSuccess}>Pendientes</p>
                  </article>
                  <article className={styles.metricCard}>
                    <span>Reportes</span>
                    <strong>{adminSummary?.openReportsCount ?? 0}</strong>
                    <p className={adminSummary?.highSeverityOpenReportsCount ? styles.metricDanger : styles.metricSuccess}>
                      {adminSummary?.highSeverityOpenReportsCount ?? 0} críticos
                    </p>
                  </article>
                  <article className={styles.metricCard}>
                    <span>Sanciones</span>
                    <strong>{adminSummary?.activeSanctionsCount ?? 0}</strong>
                    <p className={styles.metricNeutral}>Activas</p>
                  </article>
                  <article className={styles.metricCard}>
                    <span>Apelaciones</span>
                    <strong>{adminSummary?.pendingAppealsCount ?? 0}</strong>
                    <p className={adminSummary?.pendingAppealsCount ? styles.metricWarning : styles.metricSuccess}>Por revisar</p>
                  </article>
                </div>
              </section>

              <section className={styles.cardSection}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.kicker}>Bandejas</p>
                    <h2>Pendientes de hoy</h2>
                  </div>
                  <StatusPill
                    label={adminSummary?.highSeverityOpenReportsCount ? 'Atencion inmediata' : 'Flujo estable'}
                    tone={adminSummary?.highSeverityOpenReportsCount ? 'warning' : 'success'}
                  />
                </div>

                <div className={styles.actionGrid}>
                  {adminQueues.map((queue) => (
                    <Link key={queue.title} className={styles.quickLink} href={queue.href}>
                      <strong>{queue.title}</strong>
                      <span>{queue.note}</span>
                      <span className={styles.queueCount}>{queue.count}</span>
                    </Link>
                  ))}
                </div>
              </section>

              <section className={styles.cardSection}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.kicker}>Sesion</p>
                    <h2>Alcance actual</h2>
                  </div>
                </div>

                <div className={styles.infoGrid}>
                  <article className={styles.infoTile}>
                    <span>Correo</span>
                    <strong>{authSession?.user.email ?? 'No disponible'}</strong>
                  </article>
                  <article className={styles.infoTile}>
                    <span>Institucion</span>
                    <strong>{currentMembership?.institutionName ?? 'Sin institucion activa'}</strong>
                  </article>
                  <article className={styles.infoTile}>
                    <span>Rol institucional</span>
                    <strong>
                      {currentMembership?.role === InstitutionMembershipRole.InstitutionAdmin
                        ? 'Administrador institucional'
                        : 'Sin rol administrativo institucional'}
                    </strong>
                  </article>
                </div>
              </section>
            </div>

            <aside className={styles.sideColumn}>
              <section className={styles.cardSection}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.kicker}>Gestion</p>
                    <h2>Accesos directos</h2>
                  </div>
                </div>
                <div className={styles.quickGrid}>
                  <Link className={styles.quickLink} href="/moderacion?section=driver">
                    <strong>Conductores</strong>
                    <span>Revisar nuevas solicitudes</span>
                  </Link>
                  <Link className={styles.quickLink} href="/moderacion?section=reports">
                    <strong>Reportes</strong>
                    <span>Resolver incidentes</span>
                  </Link>
                  <Link className={styles.quickLink} href="/usuarios">
                    <strong>Usuarios</strong>
                    <span>Gestionar cuentas</span>
                  </Link>
                  <Link className={styles.quickLink} href="/auditoria">
                    <strong>Auditoria</strong>
                    <span>Ver trazabilidad</span>
                  </Link>
                </div>
              </section>
            </aside>
          </div>
        ) : (
          <div className={styles.stackLayout}>
            <section className={styles.cardSection}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.kicker}>Desempeño</p>
                  <h2>Métricas de confianza</h2>
                </div>
                <StatusPill
                  label={
                    currentMembership
                      ? getDriverStatusLabel(
                          effectiveDriverStatus ?? currentMembership.driverVerificationStatus,
                        )
                      : 'Sin membresia'
                  }
                  tone={
                    currentMembership
                      ? getDriverStatusTone(
                          effectiveDriverStatus ?? currentMembership.driverVerificationStatus,
                        )
                      : 'neutral'
                  }
                />
              </div>

              <div className={styles.metricGrid}>
                <article className={`${styles.metricCard} ${styles.metricCardText}`}>
                  <span>Nivel visible</span>
                  <strong>{visibleTrustLabel}</strong>
                  <p className={styles.metricNeutral}>Reputación</p>
                </article>
                <article className={`${styles.metricCard} ${styles.metricCardText}`}>
                  <span>Riesgo admin.</span>
                  <strong>{administrativeRiskLabel}</strong>
                  <p className={styles.metricNeutral}>Evaluación</p>
                </article>
                <article className={`${styles.metricCard} ${styles.metricCardText}`}>
                  <span>Licencia</span>
                  <strong>
                    {currentMembership
                      ? getDriverLicenseStatusLabel(currentMembership.licenseStatus)
                      : 'N/A'}
                  </strong>
                  <p className={styles.metricNeutral}>Documento</p>
                </article>
                <article className={`${styles.metricCard} ${styles.metricCardText}`}>
                  <span>Restricciones</span>
                  <strong>{restrictions.message ? 'Activas' : 'Ninguna'}</strong>
                  <p className={restrictions.message ? styles.metricWarning : styles.metricSuccess}>
                    {restrictions.message ? 'Requiere atención' : 'Sin bloqueos'}
                  </p>
                </article>
              </div>
            </section>

            <section className={styles.cardSection}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.kicker}>Estado</p>
                  <h2>Contexto actual</h2>
                </div>
              </div>

              <div className={styles.infoGridHorizontal}>
                <article className={styles.infoTile}>
                  <span>Institucion</span>
                  <strong>{currentMembership?.institutionName ?? 'Sin institucion activa'}</strong>
                </article>
                <article className={styles.infoTile}>
                  <span>Correo asociado</span>
                  <strong>{authSession?.user.email ?? 'No disponible'}</strong>
                </article>
                <article className={styles.infoTile}>
                  <span>Restricciones</span>
                  <strong>{restrictions.message ?? 'Sin bloqueos activos'}</strong>
                </article>
              </div>

              {driverLicenseMessage ? (
                <div className={styles.noticeCard}>
                  <strong>Licencia</strong>
                  <span>{driverLicenseMessage}</span>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
