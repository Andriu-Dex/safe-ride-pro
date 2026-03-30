'use client';

import {
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
  ReportStatus,
} from '@saferidepro/shared-types';
import { useEffect, useMemo, useState } from 'react';

import { AuditFiltersPanel } from '../../../modules/audit/components/audit-filters-panel';
import { listAuditEvents } from '../../../modules/audit/lib/audit-api';
import { getAuditActionLabel, getAuditEntityTypeLabel } from '../../../modules/audit/lib/audit-labels';
import type { AuditEventRecord, AuditFilters } from '../../../modules/audit/types/audit';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { listReviewableReports, reviewReport } from '../../../modules/reports/lib/report-api';
import { getReportReasonLabel, getReportStatusLabel, getReportStatusTone } from '../../../modules/reports/lib/report-labels';
import type { ReportRecord } from '../../../modules/reports/types/report';
import { Button } from '../../../components/ui/button';
import { InfoCard } from '../../../components/ui/info-card';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { TextareaField } from '../../../components/ui/textarea-field';
import { ApiError } from '../../../lib/api-client';

const EMPTY_AUDIT_FILTERS: AuditFilters = {
  institutionId: undefined,
  action: undefined,
  entityType: undefined,
  from: undefined,
  to: undefined,
  limit: '50',
};

function toIsoDateTime(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return parsedDate.toISOString();
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

export default function AuditPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [reviewableReports, setReviewableReports] = useState<ReportRecord[]>([]);
  const [auditFilterValues, setAuditFilterValues] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [appliedAuditFilters, setAppliedAuditFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isReviewingReportId, setIsReviewingReportId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const adminMemberships = useMemo(
    () =>
      authSession?.user.memberships.filter(
        (membership) =>
          membership.role === InstitutionMembershipRole.InstitutionAdmin &&
          isOperationalMembership(membership),
      ) ?? [],
    [authSession],
  );

  const canAccessAdminView = Boolean(
    authSession &&
      (
        authSession.user.globalRole === GlobalUserRole.SuperAdmin ||
        adminMemberships.length > 0
      ),
  );

  const loadData = async (
    accessToken: string,
    filters: AuditFilters,
    nextReportStatusFilter: string,
  ) => {
    const [auditItems, reportItems] = await Promise.all([
      listAuditEvents(accessToken, filters),
      listReviewableReports(accessToken, {
        institutionId: filters.institutionId,
        status: nextReportStatusFilter ? nextReportStatusFilter as ReportStatus : undefined,
        limit: 25,
      }),
    ]);

    setAuditEvents(auditItems);
    setReviewableReports(reportItems);
  };

  const refreshData = async (showSpinner = false) => {
    if (!authSession || !canAccessAdminView) {
      return;
    }

    if (showSpinner) {
      setIsRefreshingData(true);
    }

    try {
      await loadData(authSession.accessToken, appliedAuditFilters, reportStatusFilter);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible sincronizar auditoria y reportes administrativos.'),
      );
    } finally {
      if (showSpinner) {
        setIsRefreshingData(false);
      }
    }
  };

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession) {
      return;
    }

    if (!canAccessAdminView) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await loadData(authSession.accessToken, appliedAuditFilters, reportStatusFilter);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : 'No fue posible cargar auditoria y reportes administrativos.',
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
  }, [appliedAuditFilters, authSession, canAccessAdminView, isHydrated, reportStatusFilter]);

  useAutoRefresh(
    async () => {
      await refreshData();
    },
    {
      enabled: Boolean(authSession && isHydrated && canAccessAdminView),
      intervalMs: 20_000,
    },
  );

  const handleFilterChange = (field: keyof AuditFilters, value: string) => {
    setAuditFilterValues((currentFilters) => ({
      ...currentFilters,
      [field]: value === '' ? undefined : value,
    }));
  };

  const handleApplyFilters = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsApplyingFilters(true);
    setErrorMessage(null);

    try {
      setAppliedAuditFilters({
        institutionId: auditFilterValues.institutionId,
        action: auditFilterValues.action,
        entityType: auditFilterValues.entityType,
        from: toIsoDateTime(auditFilterValues.from),
        to: toIsoDateTime(auditFilterValues.to),
        limit: auditFilterValues.limit ?? '50',
      });
    } finally {
      setIsApplyingFilters(false);
    }
  };

  const handleResetFilters = () => {
    setAuditFilterValues(EMPTY_AUDIT_FILTERS);
    setAppliedAuditFilters(EMPTY_AUDIT_FILTERS);
    setReportStatusFilter('');
  };

  const handleReviewNoteChange = (reportId: string, value: string) => {
    setReviewNotes((currentNotes) => ({
      ...currentNotes,
      [reportId]: value,
    }));
  };

  const handleReviewReport = async (reportId: string, status: ReportStatus) => {
    if (!authSession) {
      return;
    }

    const reviewNote = reviewNotes[reportId]?.trim();

    if (
      (status === ReportStatus.Resolved || status === ReportStatus.Dismissed) &&
      !reviewNote
    ) {
      setErrorMessage('Debes indicar una nota administrativa antes de cerrar el reporte.');
      return;
    }

    setIsReviewingReportId(reportId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await reviewReport(authSession.accessToken, reportId, {
        status,
        reviewNote,
      });

      await loadData(authSession.accessToken, appliedAuditFilters, reportStatusFilter);
      setSuccessMessage(response.message);
      setReviewNotes((currentNotes) => ({
        ...currentNotes,
        [reportId]: '',
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible actualizar el reporte.'));
      await refreshData();
    } finally {
      setIsReviewingReportId(null);
    }
  };

  const openReportsCount = reviewableReports.filter(
    (report) => report.status === ReportStatus.Pending || report.status === ReportStatus.UnderReview,
  ).length;
  const institutionOptions = adminMemberships.map((membership) => ({
    id: membership.institutionId,
    name: membership.institutionName,
  }));

  if (isLoading) {
    return (
      <section className="loading-state compact-loading-state">
        <div className="loading-card">
          <div aria-hidden="true" className="loading-pulse" />
          <h1 className="panel-title">Cargando auditoria</h1>
          <p className="panel-text">
            Estamos preparando los eventos criticos y la bandeja administrativa de reportes.
          </p>
        </div>
      </section>
    );
  }

  if (!canAccessAdminView) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="topbar-title">Auditoria</h1>
            <p className="topbar-subtitle">Vista reservada para administradores institucionales y superadministracion.</p>
          </div>
          <StatusPill label="Acceso restringido" tone="warning" />
        </header>

        <section className="empty-state">
          <div className="empty-state-card">
            <h2 className="panel-title">Permisos insuficientes</h2>
            <p className="empty-state-text">
              Tu sesion actual no tiene permisos administrativos para consultar auditoria ni revisar reportes institucionales.
            </p>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Auditoria</h1>
          <p className="topbar-subtitle">
            Supervisa eventos criticos del sistema y revisa los reportes abiertos de tus instituciones.
          </p>
        </div>
        <div className="topbar-actions">
          <Button
            disabled={isRefreshingData}
            onClick={() => void refreshData(true)}
            variant="secondary"
          >
            {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
          </Button>
          <StatusPill
            label={openReportsCount ? `${openReportsCount} reportes abiertos` : 'Bandeja al dia'}
            tone={openReportsCount ? 'warning' : 'success'}
          />
        </div>
      </header>

      <section className="content-grid">
        <div className="metrics-grid">
          <InfoCard
            description="Eventos devueltos por la consulta actual de auditoria."
            label="Eventos visibles"
            value={`${auditEvents.length}`}
          />
          <InfoCard
            description="Reportes pendientes o en revision disponibles para gestion administrativa."
            label="Reportes abiertos"
            value={`${openReportsCount}`}
          />
          <InfoCard
            description="Instituciones administrativas accesibles desde tu sesion activa."
            label="Instituciones"
            value={`${institutionOptions.length || (authSession?.user.globalRole === GlobalUserRole.SuperAdmin ? 1 : 0)}`}
          />
        </div>

        <AuditFiltersPanel
          institutionOptions={institutionOptions}
          isSubmitting={isApplyingFilters}
          onApply={handleApplyFilters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          values={auditFilterValues}
        />

        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        {successMessage ? <div className="form-success">{successMessage}</div> : null}

        <div className="page-grid page-grid-wide">
          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Eventos registrados</h2>
              <p className="section-heading-meta">{auditEvents.length} resultados</p>
            </div>
            {auditEvents.length ? (
              <div className="list-stack">
                {auditEvents.map((event) => (
                  <div key={event.id} className="list-card">
                    <div className="list-card-header">
                      <strong>{getAuditActionLabel(event.action)}</strong>
                      <StatusPill label={getAuditEntityTypeLabel(event.entityType)} tone="neutral" />
                    </div>
                    <p className="panel-text">
                      Actor: {event.actorFullName ?? 'Sistema'} | Fecha: {formatDateTime(event.createdAt)}
                    </p>
                    <p className="panel-text">
                      Institucion: {event.institutionName ?? 'No aplica'} | Entidad: {event.entityId ?? 'Sin referencia'}
                    </p>
                    {event.metadata ? (
                      <pre className="json-block">{JSON.stringify(event.metadata, null, 2)}</pre>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-text">
                No hay eventos para los filtros actuales. Ajusta la fecha, la accion o la institucion para ampliar la consulta.
              </p>
            )}
          </article>

          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Bandeja de reportes</h2>
              <p className="section-heading-meta">{reviewableReports.length} resultados</p>
            </div>

            <SelectField
              label="Estado del reporte"
              onChange={(event) => setReportStatusFilter(event.target.value)}
              value={reportStatusFilter}
            >
              <option value="">Todos</option>
              <option value={ReportStatus.Pending}>Pendientes</option>
              <option value={ReportStatus.UnderReview}>En revision</option>
              <option value={ReportStatus.Resolved}>Resueltos</option>
              <option value={ReportStatus.Dismissed}>Desestimados</option>
            </SelectField>

            {reviewableReports.length ? (
              <div className="list-stack">
                {reviewableReports.map((report) => (
                  <div key={report.id} className="list-card">
                    <div className="list-card-header">
                      <strong>{report.reportedFullName}</strong>
                      <StatusPill
                        label={getReportStatusLabel(report.status)}
                        tone={getReportStatusTone(report.status)}
                      />
                    </div>
                    <p className="panel-text">
                      Reportante: {report.reporterFullName} | Viaje: {report.tripOriginLabel} -&gt; {report.tripDestinationLabel}
                    </p>
                    <p className="panel-text">
                      Motivo: {getReportReasonLabel(report.reason)} | Fecha: {formatDateTime(report.createdAt)}
                    </p>
                    {report.description ? <p className="panel-text">Descripcion: {report.description}</p> : null}
                    {report.evidenceFileKey ? (
                      <p className="panel-text">Referencia de evidencia: {report.evidenceFileKey}</p>
                    ) : null}
                    {report.reviewNote ? (
                      <p className="panel-text">Nota de revision: {report.reviewNote}</p>
                    ) : null}

                    {report.status === ReportStatus.Pending || report.status === ReportStatus.UnderReview ? (
                      <>
                        <TextareaField
                          label="Nota administrativa"
                          onChange={(event) => handleReviewNoteChange(report.id, event.target.value)}
                          placeholder="Comentario interno o motivo de la decision"
                          rows={3}
                          value={reviewNotes[report.id] ?? ''}
                        />
                        <div className="button-row">
                          {report.status === ReportStatus.Pending ? (
                            <Button
                              disabled={isReviewingReportId === report.id}
                              onClick={() => void handleReviewReport(report.id, ReportStatus.UnderReview)}
                              variant="secondary"
                            >
                              Marcar en revision
                            </Button>
                          ) : null}
                          <Button
                            disabled={isReviewingReportId === report.id || !(reviewNotes[report.id]?.trim())}
                            onClick={() => void handleReviewReport(report.id, ReportStatus.Resolved)}
                          >
                            Resolver
                          </Button>
                          <Button
                            disabled={isReviewingReportId === report.id || !(reviewNotes[report.id]?.trim())}
                            onClick={() => void handleReviewReport(report.id, ReportStatus.Dismissed)}
                            variant="ghost"
                          >
                            Desestimar
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="panel-text">
                        Este reporte ya fue cerrado por {report.reviewedByFullName ?? 'administracion'}.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-text">
                No hay reportes administrativos para el filtro actual.
              </p>
            )}
          </article>
        </div>
      </section>
    </>
  );
}
