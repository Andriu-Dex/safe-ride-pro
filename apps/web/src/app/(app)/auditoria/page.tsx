'use client';

import {
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
  OperationalSanctionAppealStatus,
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
import {
  getReportReasonLabel,
  getReportSeverityLabel,
  getReportSeverityTone,
  getReportStatusLabel,
  getReportStatusTone,
  HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH,
  requiresDetailedReviewNote,
} from '../../../modules/reports/lib/report-labels';
import type { ReportRecord } from '../../../modules/reports/types/report';
import {
  downloadDriverApplicationDocument,
  listReviewableDriverApplications,
  reviewDriverApplication,
} from '../../../modules/driver/lib/driver-api';
import { buildDriverDocumentFileName } from '../../../modules/driver/lib/driver-document-file';
import {
  getDriverLicenseStatusLabel,
  getDriverLicenseStatusTone,
  getDriverStatusLabel,
  getDriverStatusTone,
} from '../../../modules/driver/lib/driver-status';
import type { ReviewableDriverApplicationRecord } from '../../../modules/driver/types/driver';
import {
  liftOperationalSanction,
  listReviewableActiveSanctions,
  listReviewableSanctionAppeals,
  reviewSanctionAppeal,
} from '../../../modules/sanctions/lib/sanction-api';
import {
  getSanctionAppealStatusLabel,
  getSanctionAppealStatusTone,
  MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH,
  SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH,
} from '../../../modules/sanctions/lib/sanction-labels';
import type {
  OperationalSanctionAppealRecord,
  ReviewableOperationalSanctionRecord,
} from '../../../modules/sanctions/types/sanction';
import { Button } from '../../../components/ui/button';
import { FilePreviewModal } from '../../../components/ui/file-preview-modal';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { TextareaField } from '../../../components/ui/textarea-field';
import { downloadBlobFile } from '../../../lib/blob-file';
import { ApiError } from '../../../lib/api-client';
import {
  getOperationalSanctionScopeLabel,
  getOperationalSanctionTone,
  getOperationalSanctionTypeLabel,
} from '../../../modules/users/lib/trust-labels';

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

type MetadataEntry = {
  key: string;
  value: string;
};

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'No disponible';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'Sin elementos';
    }

    const preview = value
      .slice(0, 3)
      .map((item) => formatMetadataValue(item))
      .join(', ');

    return value.length > 3 ? `${preview} (+${value.length - 3})` : preview;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length ? `Objeto con ${keys.length} campos` : 'Objeto vacio';
  }

  return String(value);
}

function extractMetadataEntries(metadata: Record<string, unknown> | null): MetadataEntry[] {
  if (!metadata) {
    return [];
  }

  const entries: MetadataEntry[] = [];

  const walkObject = (
    objectValue: Record<string, unknown>,
    parentKey = '',
    depth = 0,
  ) => {
    Object.entries(objectValue).forEach(([key, value]) => {
      const fullKey = parentKey ? `${parentKey}.${key}` : key;
      const canWalkNestedObject =
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        depth < 1;

      if (canWalkNestedObject) {
        walkObject(value as Record<string, unknown>, fullKey, depth + 1);
        return;
      }

      entries.push({
        key: fullKey,
        value: formatMetadataValue(value),
      });
    });
  };

  walkObject(metadata);
  return entries;
}

type DriverDocumentPreviewState = {
  membershipId: string;
  documentType: 'identity' | 'license';
  fileName: string;
  fileUrl: string;
  mimeType: string;
  title: string;
};

type AuditWorkspaceSection =
  | 'driver'
  | 'events'
  | 'reports'
  | 'sanctions'
  | 'appeals';

export default function AuditPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [reviewableReports, setReviewableReports] = useState<ReportRecord[]>([]);
  const [reviewableDriverApplications, setReviewableDriverApplications] = useState<
    ReviewableDriverApplicationRecord[]
  >([]);
  const [reviewableSanctions, setReviewableSanctions] = useState<
    ReviewableOperationalSanctionRecord[]
  >([]);
  const [reviewableAppeals, setReviewableAppeals] = useState<
    OperationalSanctionAppealRecord[]
  >([]);
  const [auditFilterValues, setAuditFilterValues] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [appliedAuditFilters, setAppliedAuditFilters] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('');
  const [driverApplicationStatusFilter, setDriverApplicationStatusFilter] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [driverReviewNotes, setDriverReviewNotes] = useState<Record<string, string>>({});
  const [appealReviewNotes, setAppealReviewNotes] = useState<Record<string, string>>({});
  const [sanctionLiftNotes, setSanctionLiftNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isReviewingReportId, setIsReviewingReportId] = useState<string | null>(null);
  const [isReviewingDriverMembershipId, setIsReviewingDriverMembershipId] = useState<string | null>(null);
  const [isDownloadingDriverDocumentKey, setIsDownloadingDriverDocumentKey] = useState<string | null>(null);
  const [isOpeningDriverDocumentKey, setIsOpeningDriverDocumentKey] = useState<string | null>(null);
  const [isReviewingAppealId, setIsReviewingAppealId] = useState<string | null>(null);
  const [isLiftingSanctionId, setIsLiftingSanctionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [driverDocumentPreview, setDriverDocumentPreview] =
    useState<DriverDocumentPreviewState | null>(null);
  const [driverDocumentPreviewError, setDriverDocumentPreviewError] = useState<string | null>(
    null,
  );
  const [activeWorkspace, setActiveWorkspace] =
    useState<AuditWorkspaceSection>('reports');
  const [expandedAuditEventIds, setExpandedAuditEventIds] = useState<Record<string, boolean>>({});

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
    nextDriverApplicationStatusFilter: string,
  ) => {
    const [auditItems, reportItems, driverApplicationItems, sanctionItems, appealItems] = await Promise.all([
      listAuditEvents(accessToken, filters),
      listReviewableReports(accessToken, {
        institutionId: filters.institutionId,
        status: nextReportStatusFilter ? nextReportStatusFilter as ReportStatus : undefined,
        limit: 25,
      }),
      listReviewableDriverApplications(accessToken, {
        institutionId: filters.institutionId,
        status: nextDriverApplicationStatusFilter,
        limit: 25,
      }),
      listReviewableActiveSanctions(accessToken, {
        institutionId: filters.institutionId,
        limit: 25,
      }),
      listReviewableSanctionAppeals(accessToken, {
        institutionId: filters.institutionId,
        limit: 25,
      }),
    ]);

    setAuditEvents(auditItems);
    setReviewableReports(reportItems);
    setReviewableDriverApplications(driverApplicationItems);
    setReviewableSanctions(sanctionItems);
    setReviewableAppeals(appealItems);
  };

  const refreshData = async (showSpinner = false) => {
    if (!authSession || !canAccessAdminView) {
      return;
    }

    if (showSpinner) {
      setIsRefreshingData(true);
    }

    try {
      await loadData(
        authSession.accessToken,
        appliedAuditFilters,
        reportStatusFilter,
        driverApplicationStatusFilter,
      );
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
        await loadData(
          authSession.accessToken,
          appliedAuditFilters,
          reportStatusFilter,
          driverApplicationStatusFilter,
        );
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
  }, [
    appliedAuditFilters,
    authSession,
    canAccessAdminView,
    driverApplicationStatusFilter,
    isHydrated,
    reportStatusFilter,
  ]);

  useAutoRefresh(
    async () => {
      await refreshData();
    },
    {
      enabled: Boolean(authSession && isHydrated && canAccessAdminView),
      intervalMs: 20_000,
    },
  );

  useEffect(() => {
    return () => {
      if (driverDocumentPreview?.fileUrl) {
        URL.revokeObjectURL(driverDocumentPreview.fileUrl);
      }
    };
  }, [driverDocumentPreview]);

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
    setDriverApplicationStatusFilter('');
  };

  const handleReviewNoteChange = (reportId: string, value: string) => {
    setReviewNotes((currentNotes) => ({
      ...currentNotes,
      [reportId]: value,
    }));
  };

  const handleAppealReviewNoteChange = (appealId: string, value: string) => {
    setAppealReviewNotes((currentNotes) => ({
      ...currentNotes,
      [appealId]: value,
    }));
  };

  const handleSanctionLiftNoteChange = (sanctionId: string, value: string) => {
    setSanctionLiftNotes((currentNotes) => ({
      ...currentNotes,
      [sanctionId]: value,
    }));
  };

  const handleDriverReviewNoteChange = (membershipId: string, value: string) => {
    setDriverReviewNotes((currentNotes) => ({
      ...currentNotes,
      [membershipId]: value,
    }));
  };

  const toggleAuditEventExpanded = (eventId: string) => {
    setExpandedAuditEventIds((currentMap) => ({
      ...currentMap,
      [eventId]: !currentMap[eventId],
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

      await loadData(
        authSession.accessToken,
        appliedAuditFilters,
        reportStatusFilter,
        driverApplicationStatusFilter,
      );
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

  const handleReviewDriverApplication = async (
    membershipId: string,
    decision: DriverVerificationStatus.Approved | DriverVerificationStatus.Rejected,
  ) => {
    if (!authSession) {
      return;
    }

    const reviewNote = driverReviewNotes[membershipId]?.trim();

    if (decision === DriverVerificationStatus.Rejected && !reviewNote) {
      setErrorMessage(
        'Debes indicar una nota administrativa antes de rechazar la solicitud de conductor.',
      );
      return;
    }

    setIsReviewingDriverMembershipId(membershipId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await reviewDriverApplication(
        authSession.accessToken,
        membershipId,
        {
          decision,
          reviewNotes: reviewNote,
        },
      );

      await loadData(
        authSession.accessToken,
        appliedAuditFilters,
        reportStatusFilter,
        driverApplicationStatusFilter,
      );
      setSuccessMessage(response.message);
      setDriverReviewNotes((currentNotes) => ({
        ...currentNotes,
        [membershipId]: '',
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible revisar la solicitud de conductor.'),
      );
      await refreshData();
    } finally {
      setIsReviewingDriverMembershipId(null);
    }
  };

  const resetDriverDocumentPreview = () => {
    setDriverDocumentPreviewError(null);
    setDriverDocumentPreview((currentPreview) => {
      if (currentPreview?.fileUrl) {
        URL.revokeObjectURL(currentPreview.fileUrl);
      }

      return null;
    });
  };

  const fetchDriverDocument = async (
    membershipId: string,
    documentType: 'identity' | 'license',
    userFullName: string,
  ) => {
    if (!authSession) {
      throw new ApiError('No fue posible autenticar la descarga del documento.', 401);
    }

    const blob = await downloadDriverApplicationDocument(
      authSession.accessToken,
      membershipId,
      documentType,
    );

    return {
      blob,
      fileName: buildDriverDocumentFileName(documentType, userFullName, blob.type),
      title:
        documentType === 'identity'
          ? 'Documento de identidad'
          : 'Documento de licencia',
    };
  };

  const handleOpenDriverDocumentPreview = async (
    membershipId: string,
    documentType: 'identity' | 'license',
    userFullName: string,
  ) => {
    if (!authSession) {
      return;
    }

    const previewKey = `${membershipId}-${documentType}`;
    setIsOpeningDriverDocumentKey(previewKey);
    setErrorMessage(null);
    setDriverDocumentPreviewError(null);

    try {
      const { blob, fileName, title } = await fetchDriverDocument(
        membershipId,
        documentType,
        userFullName,
      );
      const objectUrl = URL.createObjectURL(blob);

      setDriverDocumentPreview((currentPreview) => {
        if (currentPreview?.fileUrl) {
          URL.revokeObjectURL(currentPreview.fileUrl);
        }

        return {
          membershipId,
          documentType,
          fileName,
          fileUrl: objectUrl,
          mimeType: blob.type,
          title,
        };
      });
    } catch (error) {
      setDriverDocumentPreviewError(
        getApiErrorMessage(
          error,
          'No fue posible abrir la previsualizacion del documento del conductor.',
        ),
      );
    } finally {
      setIsOpeningDriverDocumentKey(null);
    }
  };

  const handleDownloadDriverDocument = async (
    membershipId: string,
    documentType: 'identity' | 'license',
    userFullName: string,
  ) => {
    if (!authSession) {
      return;
    }

    const downloadKey = `${membershipId}-${documentType}`;
    setIsDownloadingDriverDocumentKey(downloadKey);
    setErrorMessage(null);

    try {
      const { blob, fileName } = await fetchDriverDocument(
        membershipId,
        documentType,
        userFullName,
      );

      downloadBlobFile(blob, fileName);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible descargar el documento del conductor.'),
      );
    } finally {
      setIsDownloadingDriverDocumentKey(null);
    }
  };

  const handleReviewAppeal = async (
    appealId: string,
    status: OperationalSanctionAppealStatus,
  ) => {
    if (!authSession) {
      return;
    }

    const reviewNote = appealReviewNotes[appealId]?.trim();

    if (
      !reviewNote ||
      reviewNote.length < SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH
    ) {
      setErrorMessage(
        `Debes indicar una nota administrativa de al menos ${SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH} caracteres para revisar la apelacion.`,
      );
      return;
    }

    setIsReviewingAppealId(appealId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await reviewSanctionAppeal(authSession.accessToken, appealId, {
        status,
        reviewNote,
      });

      await loadData(
        authSession.accessToken,
        appliedAuditFilters,
        reportStatusFilter,
        driverApplicationStatusFilter,
      );
      setSuccessMessage(response.message);
      setAppealReviewNotes((currentNotes) => ({
        ...currentNotes,
        [appealId]: '',
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible revisar la apelacion.'));
      await refreshData();
    } finally {
      setIsReviewingAppealId(null);
    }
  };

  const handleLiftSanction = async (sanctionId: string) => {
    if (!authSession) {
      return;
    }

    const reviewNote = sanctionLiftNotes[sanctionId]?.trim();

    if (
      !reviewNote ||
      reviewNote.length < MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH
    ) {
      setErrorMessage(
        `Debes indicar una nota administrativa de al menos ${MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH} caracteres para levantar la sancion.`,
      );
      return;
    }

    setIsLiftingSanctionId(sanctionId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await liftOperationalSanction(authSession.accessToken, sanctionId, {
        reviewNote,
      });

      await loadData(
        authSession.accessToken,
        appliedAuditFilters,
        reportStatusFilter,
        driverApplicationStatusFilter,
      );
      setSuccessMessage(response.message);
      setSanctionLiftNotes((currentNotes) => ({
        ...currentNotes,
        [sanctionId]: '',
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible levantar la sancion.'));
      await refreshData();
    } finally {
      setIsLiftingSanctionId(null);
    }
  };

  const openReportsCount = reviewableReports.filter(
    (report) => report.status === ReportStatus.Pending || report.status === ReportStatus.UnderReview,
  ).length;
  const pendingDriverApplicationsCount = reviewableDriverApplications.filter(
    (application) =>
      application.driverVerificationStatus ===
      DriverVerificationStatus.PendingVerification,
  ).length;
  const pendingAppealsCount = reviewableAppeals.filter(
    (appeal) => appeal.status === OperationalSanctionAppealStatus.Pending,
  ).length;
  const highSeverityOpenReportsCount = reviewableReports.filter(
    (report) =>
      requiresDetailedReviewNote(report.reason) &&
      (report.status === ReportStatus.Pending || report.status === ReportStatus.UnderReview),
  ).length;
  const activeAuditFiltersCount = [
    appliedAuditFilters.institutionId,
    appliedAuditFilters.action,
    appliedAuditFilters.entityType,
    appliedAuditFilters.from,
    appliedAuditFilters.to,
  ].filter(Boolean).length;
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
      <section className="audit-shell">
        <section className="audit-command">
          <div className="audit-command-copy">
            <p className="section-label">Admin</p>
            <h1 className="audit-command-title">Auditoria institucional</h1>
            <p className="audit-command-subtitle">
              Vista reservada para administradores institucionales y superadministracion.
            </p>
          </div>
          <div className="audit-command-actions">
            <StatusPill label="Acceso restringido" tone="warning" />
          </div>
        </section>

        <section className="empty-state">
          <div className="empty-state-card">
            <h2 className="panel-title">Permisos insuficientes</h2>
            <p className="empty-state-text">
              Tu sesion actual no tiene permisos administrativos para consultar auditoria ni revisar reportes institucionales.
            </p>
          </div>
        </section>
      </section>
    );
  }

  return (
    <>
      <section className="audit-shell">
        <section className="audit-command">
          <div className="audit-command-copy">
            <p className="section-label">Admin</p>
            <h1 className="audit-command-title">Auditoria institucional</h1>
            <p className="audit-command-subtitle">
              Supervisa eventos criticos del sistema y revisa los reportes abiertos de tus instituciones.
            </p>
          </div>
          <div className="audit-command-actions">
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
            {activeAuditFiltersCount ? (
              <StatusPill label={`${activeAuditFiltersCount} filtros activos`} tone="neutral" />
            ) : null}
          </div>
        </section>

        <section className="audit-kpi-grid">
          <article className="audit-kpi-card">
            <span className="audit-kpi-label">Eventos visibles</span>
            <strong className="audit-kpi-value">{auditEvents.length}</strong>
            <p className="audit-kpi-note">Resultados de la consulta actual.</p>
          </article>
          <article className="audit-kpi-card">
            <span className="audit-kpi-label">Reportes abiertos</span>
            <strong className="audit-kpi-value">{openReportsCount}</strong>
            <p className="audit-kpi-note">
              {highSeverityOpenReportsCount > 0
                ? `${highSeverityOpenReportsCount} de alta severidad.`
                : 'Sin casos de alta severidad abiertos.'}
            </p>
          </article>
          <article className="audit-kpi-card">
            <span className="audit-kpi-label">Conductores pendientes</span>
            <strong className="audit-kpi-value">{pendingDriverApplicationsCount}</strong>
            <p className="audit-kpi-note">Solicitudes listas para revision.</p>
          </article>
          <article className="audit-kpi-card">
            <span className="audit-kpi-label">Sanciones y apelaciones</span>
            <strong className="audit-kpi-value">
              {reviewableSanctions.length} / {pendingAppealsCount}
            </strong>
            <p className="audit-kpi-note">Activas y apelaciones pendientes.</p>
          </article>
        </section>

        <AuditFiltersPanel
          institutionOptions={institutionOptions}
          isSubmitting={isApplyingFilters}
          onApply={handleApplyFilters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          values={auditFilterValues}
        />

        <div className="audit-alert-stack">
          {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
          {successMessage ? <div className="form-success">{successMessage}</div> : null}
        </div>

        <section aria-label="Secciones de auditoria" className="audit-workspace-switch">
          <button
            aria-pressed={activeWorkspace === 'reports'}
            className={[
              'audit-workspace-tab',
              activeWorkspace === 'reports' ? 'audit-workspace-tab-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveWorkspace('reports')}
            type="button"
          >
            <span>Reportes</span>
            <small>{openReportsCount} abiertos</small>
          </button>
          <button
            aria-pressed={activeWorkspace === 'driver'}
            className={[
              'audit-workspace-tab',
              activeWorkspace === 'driver' ? 'audit-workspace-tab-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveWorkspace('driver')}
            type="button"
          >
            <span>Conductores</span>
            <small>{pendingDriverApplicationsCount} pendientes</small>
          </button>
          <button
            aria-pressed={activeWorkspace === 'events'}
            className={[
              'audit-workspace-tab',
              activeWorkspace === 'events' ? 'audit-workspace-tab-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveWorkspace('events')}
            type="button"
          >
            <span>Eventos</span>
            <small>{auditEvents.length} visibles</small>
          </button>
          <button
            aria-pressed={activeWorkspace === 'sanctions'}
            className={[
              'audit-workspace-tab',
              activeWorkspace === 'sanctions' ? 'audit-workspace-tab-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveWorkspace('sanctions')}
            type="button"
          >
            <span>Sanciones</span>
            <small>{reviewableSanctions.length} activas</small>
          </button>
          <button
            aria-pressed={activeWorkspace === 'appeals'}
            className={[
              'audit-workspace-tab',
              activeWorkspace === 'appeals' ? 'audit-workspace-tab-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setActiveWorkspace('appeals')}
            type="button"
          >
            <span>Apelaciones</span>
            <small>{pendingAppealsCount} pendientes</small>
          </button>
        </section>

        <div className="page-grid page-grid-wide audit-main-grid">
          {activeWorkspace === 'driver' ? (
          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Solicitudes de conductor</h2>
              <p className="section-heading-meta">{reviewableDriverApplications.length} resultados</p>
            </div>

            <SelectField
              label="Estado de la solicitud"
              onChange={(event) => setDriverApplicationStatusFilter(event.target.value)}
              value={driverApplicationStatusFilter}
            >
              <option value="">Todos</option>
              <option value={DriverVerificationStatus.PendingVerification}>Pendientes</option>
              <option value={DriverVerificationStatus.Approved}>Aprobadas</option>
              <option value={DriverVerificationStatus.Rejected}>Rechazadas</option>
              <option value={DriverVerificationStatus.Suspended}>Suspendidas</option>
            </SelectField>

            {reviewableDriverApplications.length ? (
              <div className="list-stack">
                {reviewableDriverApplications.map((application) => {
                  const identityDocumentDownloadKey = `${application.membershipId}-identity`;
                  const licenseDocumentDownloadKey = `${application.membershipId}-license`;

                  return (
                    <div key={application.membershipId} className="list-card">
                      <div className="list-card-header">
                        <strong>{application.userFullName}</strong>
                        <div className="button-row">
                          <StatusPill
                            label={getDriverStatusLabel(application.driverVerificationStatus)}
                            tone={getDriverStatusTone(application.driverVerificationStatus)}
                          />
                          <StatusPill
                            label={getDriverLicenseStatusLabel(application.licenseStatus)}
                            tone={getDriverLicenseStatusTone(application.licenseStatus)}
                          />
                        </div>
                      </div>
                      <p className="panel-text">
                        Correo: {application.userEmail} | Institucion: {application.institutionName}
                      </p>
                      <p className="panel-text">
                        Licencia: {application.licenseType.code} - {application.licenseType.name} | Numero: {application.licenseNumber}
                      </p>
                      <p className="panel-text">
                        Expira: {formatDateTime(application.licenseExpiresAt)} | Enviada: {formatDateTime(application.submittedAt)}
                      </p>
                      {application.reviewNotes ? (
                        <p className="panel-text">Nota de revision: {application.reviewNotes}</p>
                      ) : null}

                      <div className="button-row">
                        <Button
                          disabled={
                            !application.identityDocumentFileKey ||
                            isOpeningDriverDocumentKey === identityDocumentDownloadKey
                          }
                          onClick={() =>
                            void handleOpenDriverDocumentPreview(
                              application.membershipId,
                              'identity',
                              application.userFullName,
                            )
                          }
                          variant="secondary"
                        >
                          {isOpeningDriverDocumentKey === identityDocumentDownloadKey
                            ? 'Abriendo...'
                            : 'Ver identidad'}
                        </Button>
                        <Button
                          disabled={
                            !application.identityDocumentFileKey ||
                            isDownloadingDriverDocumentKey === identityDocumentDownloadKey
                          }
                          onClick={() =>
                            void handleDownloadDriverDocument(
                              application.membershipId,
                              'identity',
                              application.userFullName,
                            )
                          }
                          variant="secondary"
                        >
                          {isDownloadingDriverDocumentKey === identityDocumentDownloadKey
                            ? 'Descargando...'
                            : 'Descargar identidad'}
                        </Button>
                        <Button
                          disabled={
                            !application.licenseDocumentFileKey ||
                            isOpeningDriverDocumentKey === licenseDocumentDownloadKey
                          }
                          onClick={() =>
                            void handleOpenDriverDocumentPreview(
                              application.membershipId,
                              'license',
                              application.userFullName,
                            )
                          }
                          variant="secondary"
                        >
                          {isOpeningDriverDocumentKey === licenseDocumentDownloadKey
                            ? 'Abriendo...'
                            : 'Ver licencia'}
                        </Button>
                        <Button
                          disabled={
                            !application.licenseDocumentFileKey ||
                            isDownloadingDriverDocumentKey === licenseDocumentDownloadKey
                          }
                          onClick={() =>
                            void handleDownloadDriverDocument(
                              application.membershipId,
                              'license',
                              application.userFullName,
                            )
                          }
                          variant="secondary"
                        >
                          {isDownloadingDriverDocumentKey === licenseDocumentDownloadKey
                            ? 'Descargando...'
                            : 'Descargar licencia'}
                        </Button>
                      </div>

                      {application.driverVerificationStatus !== DriverVerificationStatus.Approved ? (
                        <details className="audit-action-details">
                          <summary>Revisar solicitud</summary>
                          <div className="audit-action-body">
                            <TextareaField
                              label="Nota administrativa"
                              onChange={(event) =>
                                handleDriverReviewNoteChange(
                                  application.membershipId,
                                  event.target.value,
                                )
                              }
                              placeholder="Motivo de aprobacion, correcciones solicitadas o motivo del rechazo"
                              rows={3}
                              value={driverReviewNotes[application.membershipId] ?? ''}
                            />
                            <div className="button-row">
                              <Button
                                disabled={
                                  isReviewingDriverMembershipId === application.membershipId
                                }
                                onClick={() =>
                                  void handleReviewDriverApplication(
                                    application.membershipId,
                                    DriverVerificationStatus.Approved,
                                  )
                                }
                              >
                                Aprobar solicitud
                              </Button>
                              <Button
                                disabled={
                                  isReviewingDriverMembershipId === application.membershipId ||
                                  !(driverReviewNotes[application.membershipId]?.trim())
                                }
                                onClick={() =>
                                  void handleReviewDriverApplication(
                                    application.membershipId,
                                    DriverVerificationStatus.Rejected,
                                  )
                                }
                                variant="ghost"
                              >
                                Rechazar solicitud
                              </Button>
                            </div>
                          </div>
                        </details>
                      ) : (
                        <p className="panel-text">
                          Esta solicitud ya fue aprobada y el usuario ya puede operar como conductor.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="panel-text">
                No hay solicitudes de conductor dentro del alcance actual.
              </p>
            )}
          </article>
          ) : null}

          {activeWorkspace === 'events' ? (
          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Eventos registrados</h2>
              <p className="section-heading-meta">{auditEvents.length} resultados</p>
            </div>
            {auditEvents.length ? (
              <div className="list-stack">
                {auditEvents.map((event) => {
                  const metadataEntries = extractMetadataEntries(event.metadata);
                  const isEventExpanded = Boolean(expandedAuditEventIds[event.id]);

                  return (
                    <div key={event.id} className="list-card">
                      <div className="list-card-header">
                        <strong>{getAuditActionLabel(event.action)}</strong>
                        <div className="button-row">
                          <StatusPill label={getAuditEntityTypeLabel(event.entityType)} tone="neutral" />
                          <Button
                            onClick={() => toggleAuditEventExpanded(event.id)}
                            variant="ghost"
                          >
                            {isEventExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                          </Button>
                        </div>
                      </div>
                      <p className="panel-text">
                        Actor: {event.actorFullName ?? 'Sistema'} | Fecha: {formatDateTime(event.createdAt)}
                      </p>

                      {isEventExpanded ? (
                        <>
                          <p className="panel-text">
                            Institucion: {event.institutionName ?? 'No aplica'} | Entidad: {event.entityId ?? 'Sin referencia'}
                          </p>

                          {metadataEntries.length ? (
                            <div className="audit-metadata-grid">
                              {metadataEntries.slice(0, 6).map((entry, index) => (
                                <div key={`${event.id}-${entry.key}-${index}`} className="audit-metadata-item">
                                  <span>{entry.key}</span>
                                  <strong>{entry.value}</strong>
                                </div>
                              ))}
                              {metadataEntries.length > 6 ? (
                                <p className="panel-text">
                                  +{metadataEntries.length - 6} campos adicionales en metadatos.
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="panel-text">Este evento no incluye metadatos adicionales.</p>
                          )}
                        </>
                      ) : (
                        <p className="panel-text">Detalle contraido para una lectura mas rapida.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="panel-text">
                No hay eventos para los filtros actuales. Ajusta la fecha, la accion o la institucion para ampliar la consulta.
              </p>
            )}
          </article>
          ) : null}

          {activeWorkspace === 'reports' ? (
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
                      <div className="button-row">
                        <StatusPill
                          label={getReportStatusLabel(report.status)}
                          tone={getReportStatusTone(report.status)}
                        />
                        <StatusPill
                          label={getReportSeverityLabel(report.reason)}
                          tone={getReportSeverityTone(report.reason)}
                        />
                      </div>
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
                    {requiresDetailedReviewNote(report.reason) ? (
                      <p className="panel-text">
                        Este reporte es de alta severidad. Debe pasar primero a revision y requiere una nota de al menos {HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH} caracteres para cerrarse.
                      </p>
                    ) : null}

                    {report.status === ReportStatus.Pending || report.status === ReportStatus.UnderReview ? (
                      <details className="audit-action-details">
                        <summary>Gestionar reporte</summary>
                        <div className="audit-action-body">
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
                              disabled={
                                isReviewingReportId === report.id ||
                                !(reviewNotes[report.id]?.trim()) ||
                                (
                                  requiresDetailedReviewNote(report.reason) &&
                                  report.status === ReportStatus.Pending
                                ) ||
                                (
                                  requiresDetailedReviewNote(report.reason) &&
                                  (reviewNotes[report.id]?.trim().length ?? 0) < HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH
                                )
                              }
                              onClick={() => void handleReviewReport(report.id, ReportStatus.Resolved)}
                            >
                              Resolver
                            </Button>
                            <Button
                              disabled={
                                isReviewingReportId === report.id ||
                                !(reviewNotes[report.id]?.trim()) ||
                                (
                                  requiresDetailedReviewNote(report.reason) &&
                                  report.status === ReportStatus.Pending
                                ) ||
                                (
                                  requiresDetailedReviewNote(report.reason) &&
                                  (reviewNotes[report.id]?.trim().length ?? 0) < HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH
                                )
                              }
                              onClick={() => void handleReviewReport(report.id, ReportStatus.Dismissed)}
                              variant="ghost"
                            >
                              Desestimar
                            </Button>
                          </div>
                        </div>
                      </details>
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
          ) : null}

          {activeWorkspace === 'sanctions' ? (
          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Sanciones activas</h2>
              <p className="section-heading-meta">{reviewableSanctions.length} resultados</p>
            </div>

            {reviewableSanctions.length ? (
              <div className="list-stack">
                {reviewableSanctions.map((sanction) => (
                  <div key={sanction.id} className="list-card">
                    <div className="list-card-header">
                      <strong>{sanction.membershipUserFullName}</strong>
                      <div className="button-row">
                        <StatusPill
                          label={getOperationalSanctionTypeLabel(sanction.type)}
                          tone={getOperationalSanctionTone(sanction.type)}
                        />
                        <StatusPill
                          label={getOperationalSanctionScopeLabel(sanction.scope)}
                          tone="neutral"
                        />
                      </div>
                    </div>
                    <p className="panel-text">
                      Institucion: {sanction.institutionName} | Inicio: {formatDateTime(sanction.startedAt)}
                    </p>
                    <p className="panel-text">{sanction.reason}</p>
                    {sanction.endsAt ? (
                      <p className="panel-text">
                        Fin estimado: {formatDateTime(sanction.endsAt)}
                      </p>
                    ) : null}
                    <details className="audit-action-details">
                      <summary>Levantar sancion</summary>
                      <div className="audit-action-body">
                        <TextareaField
                          label="Nota administrativa para levantar"
                          onChange={(event) =>
                            handleSanctionLiftNoteChange(sanction.id, event.target.value)
                          }
                          placeholder="Justifica por que corresponde levantar manualmente esta sancion"
                          rows={3}
                          value={sanctionLiftNotes[sanction.id] ?? ''}
                        />
                        <div className="button-row">
                          <Button
                            disabled={
                              isLiftingSanctionId === sanction.id ||
                              (sanctionLiftNotes[sanction.id]?.trim().length ?? 0) <
                                MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH
                            }
                            onClick={() => void handleLiftSanction(sanction.id)}
                          >
                            {isLiftingSanctionId === sanction.id
                              ? 'Levantando...'
                              : 'Levantar manualmente'}
                          </Button>
                        </div>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-text">
                No hay sanciones activas dentro del alcance administrativo actual.
              </p>
            )}
          </article>
          ) : null}

          {activeWorkspace === 'appeals' ? (
          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Apelaciones de sanciones</h2>
              <p className="section-heading-meta">{reviewableAppeals.length} resultados</p>
            </div>

            {reviewableAppeals.length ? (
              <div className="list-stack">
                {reviewableAppeals.map((appeal) => (
                  <div key={appeal.id} className="list-card">
                    <div className="list-card-header">
                      <strong>{appeal.affectedFullName}</strong>
                      <div className="button-row">
                        <StatusPill
                          label={getSanctionAppealStatusLabel(appeal.status)}
                          tone={getSanctionAppealStatusTone(appeal.status)}
                        />
                        <StatusPill
                          label={getOperationalSanctionTypeLabel(appeal.sanctionType)}
                          tone={getOperationalSanctionTone(appeal.sanctionType)}
                        />
                      </div>
                    </div>
                    <p className="panel-text">
                      Institucion: {appeal.institutionName} | Alcance: {getOperationalSanctionScopeLabel(appeal.sanctionScope)}
                    </p>
                    <p className="panel-text">Apelacion: {appeal.reason}</p>
                    <p className="panel-text">
                      Sancion original: {appeal.sanctionReason}
                    </p>
                    {appeal.reviewNote ? (
                      <p className="panel-text">Nota de revision: {appeal.reviewNote}</p>
                    ) : null}

                    {appeal.status === OperationalSanctionAppealStatus.Pending ? (
                      <details className="audit-action-details">
                        <summary>Revisar apelacion</summary>
                        <div className="audit-action-body">
                          <TextareaField
                            label="Nota administrativa"
                            onChange={(event) =>
                              handleAppealReviewNoteChange(appeal.id, event.target.value)
                            }
                            placeholder="Explica la decision administrativa sobre la apelacion"
                            rows={3}
                            value={appealReviewNotes[appeal.id] ?? ''}
                          />
                          <div className="button-row">
                            <Button
                              disabled={
                                isReviewingAppealId === appeal.id ||
                                (appealReviewNotes[appeal.id]?.trim().length ?? 0) <
                                  SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH
                              }
                              onClick={() =>
                                void handleReviewAppeal(
                                  appeal.id,
                                  OperationalSanctionAppealStatus.Approved,
                                )
                              }
                            >
                              Aprobar apelacion
                            </Button>
                            <Button
                              disabled={
                                isReviewingAppealId === appeal.id ||
                                (appealReviewNotes[appeal.id]?.trim().length ?? 0) <
                                  SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH
                              }
                              onClick={() =>
                                void handleReviewAppeal(
                                  appeal.id,
                                  OperationalSanctionAppealStatus.Rejected,
                                )
                              }
                              variant="ghost"
                            >
                              Rechazar apelacion
                            </Button>
                          </div>
                        </div>
                      </details>
                    ) : (
                      <p className="panel-text">
                        Esta apelacion ya fue cerrada por {appeal.reviewedByFullName ?? 'administracion'}.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-text">
                No hay apelaciones de sanciones dentro del alcance actual.
              </p>
            )}
          </article>
          ) : null}
        </div>
      </section>

      <FilePreviewModal
        description={
          driverDocumentPreview?.mimeType?.startsWith('image/')
            ? 'Pasa el puntero sobre la imagen para ampliar los detalles del documento.'
            : 'Revisa el archivo antes de descargarlo o continuar con la revision administrativa.'
        }
        errorMessage={driverDocumentPreviewError}
        fileName={driverDocumentPreview?.fileName ?? null}
        fileUrl={driverDocumentPreview?.fileUrl ?? null}
        isDownloading={
          driverDocumentPreview
            ? isDownloadingDriverDocumentKey ===
              `${driverDocumentPreview.membershipId}-${driverDocumentPreview.documentType}`
            : false
        }
        isLoading={Boolean(isOpeningDriverDocumentKey)}
        isOpen={Boolean(driverDocumentPreview) || Boolean(driverDocumentPreviewError)}
        mimeType={driverDocumentPreview?.mimeType ?? null}
        onClose={resetDriverDocumentPreview}
        onDownload={
          driverDocumentPreview
            ? () =>
                void handleDownloadDriverDocument(
                  driverDocumentPreview.membershipId,
                  driverDocumentPreview.documentType,
                  reviewableDriverApplications.find(
                    (application) =>
                      application.membershipId === driverDocumentPreview.membershipId,
                  )?.userFullName ?? 'usuario',
                )
            : undefined
        }
        title={driverDocumentPreview?.title ?? 'Documento del conductor'}
      />
    </>
  );
}
