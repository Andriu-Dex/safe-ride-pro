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

import { listAuditEvents } from '../../../modules/audit/lib/audit-api';
import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { ApiError } from '../../../lib/api-client';
import { canAccessAudit } from '../../../modules/audit/lib/audit-access';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { listReviewableDriverApplications } from '../../../modules/driver/lib/driver-api';
import { getOperationalAccessState } from '../../../modules/auth/lib/operational-context';
import {
  getDriverLicenseAlertMessage,
  getDriverLicenseStatusLabel,
  getDriverStatusLabel,
  getDriverStatusTone,
} from '../../../modules/driver/lib/driver-status';
import { listReviewableReports } from '../../../modules/reports/lib/report-api';
import {
  listReviewableActiveSanctions,
  listReviewableSanctionAppeals,
} from '../../../modules/sanctions/lib/sanction-api';
import { getCurrentUserTrustSummary } from '../../../modules/users/lib/user-api';
import { requiresDetailedReviewNote } from '../../../modules/reports/lib/report-labels';
import {
  getAdministrativeRiskStateLabel,
  getAdministrativeRiskTone,
  getTrustRestrictions,
  getVisibleReputationStateLabel,
  getVisibleReputationTone,
} from '../../../modules/users/lib/trust-labels';
import type { TrustSummary } from '../../../modules/users/types/trust-summary';
import styles from './page.module.css';

type AdminDashboardSummary = {
  pendingDriverApplicationsCount: number;
  openReportsCount: number;
  highSeverityOpenReportsCount: number;
  activeSanctionsCount: number;
  pendingAppealsCount: number;
  visibleEventsCount: number;
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

export default function DashboardPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const currentMembership =
    operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [adminSummary, setAdminSummary] = useState<AdminDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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
    if (canAccessAudit(authSession?.user)) {
      const [
        driverApplications,
        reports,
        sanctions,
        appeals,
        auditEvents,
      ] = await Promise.all([
        listReviewableDriverApplications(accessToken, { limit: 25 }),
        listReviewableReports(accessToken, { limit: 25 }),
        listReviewableActiveSanctions(accessToken, { limit: 25 }),
        listReviewableSanctionAppeals(accessToken, { limit: 25 }),
        listAuditEvents(accessToken, { limit: '25' }),
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
        visibleEventsCount: auditEvents.length,
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
        pushToast('Dashboard actualizado', 'Los indicadores fueron sincronizados.', 'success');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible sincronizar el dashboard.'),
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
        await loadDashboard(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        setErrorMessage(
          getApiErrorMessage(error, 'No fue posible cargar el dashboard.'),
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
      await refreshDashboard();
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
  const driverLicenseMessage = getDriverLicenseAlertMessage(
    currentMembership?.licenseStatus,
    currentMembership?.licenseExpiresInDays,
  );
  const roleLabel = getGlobalRoleLabel(authSession?.user.globalRole ?? GlobalUserRole.User);
  const membershipRoleLabel = getMembershipRoleLabel(currentMembership?.role);
  const visibleTrustLabel = trustSummary
    ? getVisibleReputationStateLabel(trustSummary.visibleReputationState)
    : 'Pendiente';
  const administrativeRiskLabel = trustSummary
    ? getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)
    : 'Pendiente';
  const auditVisible = canAccessAudit(authSession?.user);
  const isAdminWorkspace = auditVisible;
  const isSyncing = isLoading || isRefreshing;
  const hasRestrictions =
    restrictions.blocksPassenger ||
    restrictions.blocksDriver ||
    Boolean(restrictions.message);
  const restrictionTitle = restrictions.blocksPassenger && restrictions.blocksDriver
    ? 'Movilidad limitada'
    : restrictions.blocksDriver
      ? 'Operacion de conductor limitada'
      : restrictions.blocksPassenger
        ? 'Operacion de pasajero limitada'
        : restrictions.message
          ? 'Observacion activa'
          : 'Sin bloqueos';

  const metrics = useMemo(
    () => [
      {
        label: 'Institucion',
        value: currentMembership?.institutionName ?? 'Sin institucion',
        note: membershipRoleLabel,
      },
      {
        label: 'Confianza visible',
        value: visibleTrustLabel,
        note: 'Estado reputacional actual.',
      },
      {
        label: 'Riesgo',
        value: administrativeRiskLabel,
        note: 'Lectura administrativa.',
      },
      {
        label: 'Restricciones',
        value: hasRestrictions ? restrictionTitle : 'Sin bloqueos',
        note: restrictions.message ?? 'Cuenta habilitada para operar.',
      },
    ],
    [
      administrativeRiskLabel,
      currentMembership?.institutionName,
      hasRestrictions,
      membershipRoleLabel,
      restrictionTitle,
      restrictions.message,
      visibleTrustLabel,
    ],
  );

  const adminMetrics = useMemo(
    () => [
      {
        label: 'Conductores pendientes',
        value: adminSummary?.pendingDriverApplicationsCount ?? 0,
        note: 'Solicitudes listas para revision.',
      },
      {
        label: 'Reportes abiertos',
        value: adminSummary?.openReportsCount ?? 0,
        note: adminSummary?.highSeverityOpenReportsCount
          ? `${adminSummary.highSeverityOpenReportsCount} de alta prioridad.`
          : 'Sin alta prioridad abierta.',
      },
      {
        label: 'Sanciones activas',
        value: adminSummary?.activeSanctionsCount ?? 0,
        note: 'Restricciones visibles para gestion.',
      },
      {
        label: 'Apelaciones pendientes',
        value: adminSummary?.pendingAppealsCount ?? 0,
        note: 'Casos que necesitan decision.',
      },
    ],
    [adminSummary],
  );

  if (isLoading) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.loadingShell}>
          <article className={styles.loadingCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.loadingTitle}>Cargando dashboard</h1>
            <p className={styles.loadingText}>Estamos preparando los indicadores principales.</p>
          </article>
        </section>
      </>
    );
  }

  if (isAdminWorkspace) {
    return (
      <section className={styles.dashboardShell}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />

        <section className={`${styles.hero} ${styles.reveal}`}>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Dashboard</p>
              <h1 className={styles.heroTitle}>Centro administrativo</h1>
              <p className={styles.heroLead}>
                Revisa el frente de aprobaciones, incidentes y trazabilidad sin mezclarlo con operacion de viaje.
              </p>
            </div>

            <div className={styles.heroActions}>
              <StatusPill label="Gestion activa" tone="success" />
              <Button
                disabled={isSyncing}
                onClick={() => void refreshDashboard(true)}
                variant="secondary"
              >
                {isRefreshing ? 'Actualizando...' : 'Sincronizar'}
              </Button>
            </div>
          </div>

          <div className={styles.metricGrid}>
            {adminMetrics.map((metric) => (
              <article className={styles.metricCard} key={metric.label}>
                <span className={styles.metricLabel}>{metric.label}</span>
                <strong className={styles.metricValue}>{metric.value}</strong>
                <span className={styles.metricNote}>{metric.note}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.mainGrid}>
          <div className={styles.contentColumn}>
            <article className={`${styles.focusCard} ${styles.reveal}`}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.kicker}>Gestion</p>
                  <h2>Prioridades del dia</h2>
                </div>
                <StatusPill
                  label={adminSummary?.highSeverityOpenReportsCount ? 'Atencion inmediata' : 'Flujo estable'}
                  tone={adminSummary?.highSeverityOpenReportsCount ? 'warning' : 'success'}
                />
              </div>

              <div className={styles.detailGrid}>
                <article className={styles.infoTile}>
                  <span>Conductores</span>
                  <strong>{adminSummary?.pendingDriverApplicationsCount ?? 0} por revisar</strong>
                </article>
                <article className={styles.infoTile}>
                  <span>Reportes</span>
                  <strong>{adminSummary?.openReportsCount ?? 0} abiertos</strong>
                </article>
                <article className={styles.infoTile}>
                  <span>Sanciones</span>
                  <strong>{adminSummary?.activeSanctionsCount ?? 0} activas</strong>
                </article>
                <article className={styles.infoTile}>
                  <span>Eventos</span>
                  <strong>{adminSummary?.visibleEventsCount ?? 0} visibles</strong>
                </article>
              </div>
            </article>

            <article className={`${styles.analyticsCard} ${styles.revealSoft}`}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.kicker}>Accesos</p>
                  <h2>Mesas de trabajo</h2>
                </div>
                <StatusPill label="Administracion" tone="neutral" />
              </div>

              <div className={styles.quickGrid}>
                <Link className={styles.quickLink} href="/moderacion?section=driver">
                  <strong>Conductores</strong>
                  <span>Aprueba solicitudes y revisa documentacion.</span>
                </Link>
                <Link className={styles.quickLink} href="/moderacion?section=reports">
                  <strong>Reportes</strong>
                  <span>Prioriza incidentes y documenta decisiones.</span>
                </Link>
                <Link className={styles.quickLink} href="/moderacion?section=sanctions">
                  <strong>Sanciones</strong>
                  <span>Administra restricciones activas y levantamientos.</span>
                </Link>
                <Link className={styles.quickLink} href="/moderacion?section=appeals">
                  <strong>Apelaciones</strong>
                  <span>Resuelve revisiones disciplinarias pendientes.</span>
                </Link>
              </div>
            </article>
          </div>

          <aside className={styles.sideColumn}>
            <article className={`${styles.sideCard} ${styles.revealSoft}`}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.kicker}>Alcance</p>
                  <h2>Sesion actual</h2>
                </div>
                <StatusPill label={roleLabel} tone="neutral" />
              </div>

              <div className={styles.noticeStack}>
                <div className={styles.noticeCard}>
                  <strong>Correo</strong>
                  <span>{authSession?.user.email ?? 'No disponible'}</span>
                </div>
                <div className={styles.noticeCard}>
                  <strong>Institucion principal</strong>
                  <span>{currentMembership?.institutionName ?? 'Sin institucion activa'}</span>
                </div>
                <div className={styles.noticeCard}>
                  <strong>Rol institucional</strong>
                  <span>{membershipRoleLabel}</span>
                </div>
              </div>
            </article>
          </aside>
        </section>
      </section>
    );
  }

  return (
    <section className={styles.dashboardShell}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <section className={`${styles.hero} ${styles.reveal}`}>
        <div className={styles.heroTop}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Dashboard</p>
            <h1 className={styles.heroTitle}>Lectura ejecutiva</h1>
            <p className={styles.heroLead}>
              Supervisa contexto, riesgo y restricciones desde una vista resumida.
            </p>
          </div>

          <div className={styles.heroActions}>
            <StatusPill
              label={operationalAccess.hasOperationalMembership ? 'Contexto listo' : 'Contexto limitado'}
              tone={operationalAccess.hasOperationalMembership ? 'success' : 'warning'}
            />
            <StatusPill
              label={currentMembership
                ? getDriverStatusLabel(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
                : 'Sin membresia'}
              tone={currentMembership
                ? getDriverStatusTone(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
                : 'neutral'}
            />
            <Button
              disabled={isSyncing}
              onClick={() => void refreshDashboard(true)}
              variant="secondary"
            >
              {isRefreshing ? 'Actualizando...' : 'Sincronizar'}
            </Button>
          </div>
        </div>

        <div className={styles.metricGrid}>
          {metrics.map((metric) => (
            <article className={styles.metricCard} key={metric.label}>
              <span className={styles.metricLabel}>{metric.label}</span>
              <strong className={styles.metricValue}>{metric.value}</strong>
              <span className={styles.metricNote}>{metric.note}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.mainGrid}>
        <div className={styles.contentColumn}>
          <article className={`${styles.focusCard} ${styles.reveal}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.kicker}>Operacion</p>
                <h2>Estado actual</h2>
              </div>
              <StatusPill
                label={currentMembership
                  ? getDriverStatusLabel(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
                  : 'Sin membresia'}
                tone={currentMembership
                  ? getDriverStatusTone(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
                  : 'neutral'}
              />
            </div>

            <div className={styles.detailGrid}>
              <article className={styles.infoTile}>
                <span>Rol global</span>
                <strong>{roleLabel}</strong>
              </article>
              <article className={styles.infoTile}>
                <span>Membresia</span>
                <strong>{currentMembership?.membershipStatus ?? 'Sin membresia'}</strong>
              </article>
              <article className={styles.infoTile}>
                <span>Licencia</span>
                <strong>
                  {currentMembership
                    ? getDriverLicenseStatusLabel(currentMembership.licenseStatus)
                    : 'Sin informacion'}
                </strong>
              </article>
              <article className={styles.infoTile}>
                <span>Bloqueos</span>
                <strong>{hasRestrictions ? restrictionTitle : 'Sin bloqueos'}</strong>
              </article>
            </div>

            {driverLicenseMessage ? (
              <div className={styles.alertCard}>
                <strong>Licencia</strong>
                <span>{driverLicenseMessage}</span>
              </div>
            ) : null}
          </article>

          <article className={`${styles.analyticsCard} ${styles.revealSoft}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.kicker}>Lectura</p>
                <h2>Indicadores clave</h2>
              </div>
              <StatusPill
                label={trustSummary ? 'Actual' : 'Pendiente'}
                tone={trustSummary ? getAdministrativeRiskTone(trustSummary.administrativeRiskState) : 'neutral'}
              />
            </div>

            <div className={styles.analyticsGrid}>
              <article className={styles.signalTile}>
                <span>Confianza visible</span>
                <strong>{visibleTrustLabel}</strong>
              </article>
              <article className={styles.signalTile}>
                <span>Riesgo administrativo</span>
                <strong>{administrativeRiskLabel}</strong>
              </article>
              <article className={styles.signalTile}>
                <span>Pasajero</span>
                <strong>{restrictions.blocksPassenger ? 'Restringido' : 'Habilitado'}</strong>
              </article>
              <article className={styles.signalTile}>
                <span>Conductor</span>
                <strong>{restrictions.blocksDriver ? 'Restringido' : 'Habilitado'}</strong>
              </article>
            </div>
          </article>
        </div>

        <aside className={styles.sideColumn}>
          <article className={`${styles.sideCard} ${styles.revealSoft}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.kicker}>Accesos</p>
                <h2>Rutas rapidas</h2>
              </div>
              <StatusPill label="Prioridades" tone="success" />
            </div>

            <div className={styles.quickGrid}>
              <Link className={styles.quickLink} href="/viajes">
                <strong>Viajes</strong>
                <span>Operacion diaria de movilidad.</span>
              </Link>
              <Link className={styles.quickLink} href="/conductor">
                <strong>Conductor</strong>
                <span>Estado de habilitacion y documentos.</span>
              </Link>
              <Link className={styles.quickLink} href="/vehiculos">
                <strong>Vehiculos</strong>
                <span>Disponibilidad y consistencia de flota.</span>
              </Link>
              <Link className={styles.quickLink} href="/confianza">
                <strong>Confianza</strong>
                <span>Reputacion, sanciones y apelaciones.</span>
              </Link>
              {auditVisible ? (
                <Link className={styles.quickLink} href="/auditoria">
                  <strong>Auditoria</strong>
                  <span>Eventos y trazabilidad administrativa.</span>
                </Link>
              ) : null}
            </div>
          </article>

          <article className={`${styles.sideCard} ${styles.revealSoft}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.kicker}>Alertas</p>
                <h2>Atencion inmediata</h2>
              </div>
              <StatusPill
                label={hasRestrictions ? 'Revisar' : 'Estable'}
                tone={hasRestrictions ? 'warning' : 'success'}
              />
            </div>

            <div className={styles.noticeStack}>
              <div className={styles.noticeCard}>
                <strong>Contexto institucional</strong>
                <span>
                  {currentMembership
                    ? `Operando en ${currentMembership.institutionName} como ${membershipRoleLabel.toLowerCase()}.`
                    : 'No hay membresia operativa activa en esta sesion.'}
                </span>
              </div>
              <div className={styles.noticeCard}>
                <strong>Restricciones</strong>
                <span>{restrictions.message ?? 'No se detectan bloqueos operativos activos.'}</span>
              </div>
              <div className={styles.noticeCard}>
                <strong>Confianza</strong>
                <span>
                  {trustSummary
                    ? `Visible: ${visibleTrustLabel.toLowerCase()} | Riesgo: ${administrativeRiskLabel.toLowerCase()}.`
                    : 'Aun no hay resumen disponible.'}
                </span>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </section>
  );
}
