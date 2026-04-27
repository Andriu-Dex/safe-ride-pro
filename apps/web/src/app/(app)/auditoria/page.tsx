'use client';

import {
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
  OperationalSanctionAppealStatus,
  OperationalSanctionScope,
  OperationalSanctionTrigger,
  OperationalSanctionType,
  ReportStatus,
} from '@saferidepro/shared-types';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { AuditFiltersPanel } from '../../../modules/audit/components/audit-filters-panel';
import { listAuditEvents } from '../../../modules/audit/lib/audit-api';
import { getAuditActionLabel, getAuditEntityTypeLabel } from '../../../modules/audit/lib/audit-labels';
import type { AuditEventRecord, AuditFilters } from '../../../modules/audit/types/audit';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import {
  downloadReportEvidence,
  listReviewableReports,
  reviewReport,
} from '../../../modules/reports/lib/report-api';
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
import { downloadBlobFile, getFileExtensionFromMimeType } from '../../../lib/blob-file';
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

function getElapsedHours(value: string): number {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60)),
  );
}

function formatRelativeElapsed(value: string): string {
  const elapsedHours = getElapsedHours(value);

  if (elapsedHours < 1) {
    return 'Menos de 1 h';
  }

  if (elapsedHours < 24) {
    return `${elapsedHours} h`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} d`;
}

function getOperationalSanctionTriggerLabel(trigger: OperationalSanctionTrigger): string {
  switch (trigger) {
    case OperationalSanctionTrigger.ResolvedReports:
      return 'Reportes resueltos';
    case OperationalSanctionTrigger.PassengerNoShow:
      return 'No-show de pasajero';
    case OperationalSanctionTrigger.LateDriverCancellation:
      return 'Cancelacion tardia de conductor';
    case OperationalSanctionTrigger.LatePassengerCancellation:
      return 'Cancelacion tardia de pasajero';
    default:
      return trigger;
  }
}

type AuditOutcomeTone = 'neutral' | 'warning' | 'danger' | 'success';

type AuditOutcomeSummary = {
  label: string;
  note: string;
  tone: AuditOutcomeTone;
};

function deriveReportOutcomeSummary(input: {
  report: ReportRecord;
  reportTriggeredSanctionsCount: number;
  pendingAppealsCount: number;
  totalRelatedSanctionsCount: number;
}): AuditOutcomeSummary {
  if (input.report.status === ReportStatus.Pending) {
    return {
      label: 'Sin decision aun',
      note: 'El caso todavia no genera una consecuencia operativa final.',
      tone: 'neutral',
    };
  }

  if (input.report.status === ReportStatus.UnderReview) {
    return {
      label: 'Decision en curso',
      note: 'La consecuencia operativa final depende del cierre administrativo.',
      tone: 'warning',
    };
  }

  if (input.report.status === ReportStatus.Dismissed) {
    return {
      label: 'Sin impacto disciplinario',
      note: 'El reporte fue cerrado sin sostener una accion disciplinaria visible.',
      tone: 'success',
    };
  }

  if (input.pendingAppealsCount > 0) {
    return {
      label: 'Frente de apelacion abierto',
      note: 'La resolucion ya derivo en sancion y hoy tiene revision pendiente.',
      tone: 'warning',
    };
  }

  if (input.reportTriggeredSanctionsCount > 0) {
    return {
      label: 'Sancion activa derivada',
      note: 'El cierre del reporte ya se refleja en restricciones operativas activas.',
      tone: 'danger',
    };
  }

  if (input.totalRelatedSanctionsCount > 0) {
    return {
      label: 'Impacto disciplinario visible',
      note: 'Existen sanciones activas sobre la misma persona dentro de la vista actual.',
      tone: 'warning',
    };
  }

  return {
    label: 'Resuelto sin sancion visible',
    note: 'El caso quedo cerrado y no muestra una restriccion activa en esta bandeja.',
    tone: 'success',
  };
}

function deriveSanctionOutcomeSummary(
  sanction: ReviewableOperationalSanctionRecord,
  pendingAppealsCount: number,
): AuditOutcomeSummary {
  if (pendingAppealsCount > 0) {
    return {
      label: 'Sancion bajo apelacion',
      note: 'La restriccion sigue vigente mientras exista una apelacion pendiente.',
      tone: 'warning',
    };
  }

  if (sanction.type === OperationalSanctionType.Warning) {
    return {
      label: 'Observacion activa',
      note: 'Genera antecedente visible sin bloquear operacion completa.',
      tone: 'neutral',
    };
  }

  if (sanction.scope === OperationalSanctionScope.All) {
    return {
      label: 'Bloqueo de movilidad',
      note: 'Impacta tanto la operacion como pasajero y como conductor.',
      tone: 'danger',
    };
  }

  if (sanction.scope === OperationalSanctionScope.Driver) {
    return {
      label: 'Restriccion de conductor',
      note: 'Afecta la publicacion y ejecucion de viajes como conductor.',
      tone: 'danger',
    };
  }

  return {
    label: 'Restriccion de pasajero',
    note: 'Afecta solicitudes y operacion desde el rol de pasajero.',
    tone: 'warning',
  };
}

function deriveAppealOutcomeSummary(
  appeal: OperationalSanctionAppealRecord,
): AuditOutcomeSummary {
  if (appeal.status === OperationalSanctionAppealStatus.Pending) {
    return {
      label: 'Sancion sigue vigente',
      note: 'La apelacion aun no cambia el efecto operativo actual.',
      tone: 'warning',
    };
  }

  if (appeal.status === OperationalSanctionAppealStatus.Approved) {
    return {
      label: 'Revision favorable',
      note: 'Confirma el caso a favor del usuario; revisa el estado final de la sancion.',
      tone: 'success',
    };
  }

  return {
    label: 'Sancion confirmada',
    note: 'La revision administrativa mantiene el frente disciplinario original.',
    tone: 'danger',
  };
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

type ReportEvidencePreviewState = {
  reportId: string;
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

type AuditWorkspaceHeroProps = {
  title: string;
  subtitle: string;
  actions?: ReactNode;
};

function AuditWorkspaceHero({
  title,
  subtitle,
  actions,
}: AuditWorkspaceHeroProps) {
  return (
    <section className="audit-section-command">
      <div className="audit-section-copy">
        <h2 className="audit-section-title">{title}</h2>
        <p className="audit-section-subtitle">{subtitle}</p>
      </div>
      {actions ? <div className="audit-section-actions">{actions}</div> : null}
    </section>
  );
}

type AuditMiniStatProps = {
  label: string;
  value: string | number;
  note: string;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
};

function AuditMiniStat({
  label,
  value,
  note,
  tone = 'neutral',
}: AuditMiniStatProps) {
  return (
    <article
      className={[
        'audit-mini-stat',
        tone !== 'neutral' ? `audit-mini-stat-${tone}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="audit-mini-stat-label">{label}</span>
      <strong className="audit-mini-stat-value">{value}</strong>
      <p className="audit-mini-stat-note">{note}</p>
    </article>
  );
}

function buildReportEvidenceFileName(report: ReportRecord, mimeType: string): string {
  const safeName = report.reportedFullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  const extension = getFileExtensionFromMimeType(mimeType);

  return `reporte-${safeName || 'evidencia'}-${report.id.slice(0, 8)}.${extension}`;
}

function getReportPriorityRank(report: ReportRecord): number {
  const isHighSeverity = requiresDetailedReviewNote(report.reason);

  if (report.status === ReportStatus.Pending && isHighSeverity) {
    return 0;
  }

  if (report.status === ReportStatus.UnderReview && isHighSeverity) {
    return 1;
  }

  if (report.status === ReportStatus.Pending) {
    return 2;
  }

  if (report.status === ReportStatus.UnderReview) {
    return 3;
  }

  if (report.status === ReportStatus.Resolved) {
    return 4;
  }

  return 5;
}

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
  const [reportEvidencePreview, setReportEvidencePreview] =
    useState<ReportEvidencePreviewState | null>(null);
  const [reportEvidencePreviewError, setReportEvidencePreviewError] = useState<string | null>(
    null,
  );
  const [isOpeningReportEvidenceId, setIsOpeningReportEvidenceId] = useState<string | null>(null);
  const [isDownloadingReportEvidenceId, setIsDownloadingReportEvidenceId] =
    useState<string | null>(null);
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);
  const [highlightedMembershipId, setHighlightedMembershipId] = useState<string | null>(null);
  const [highlightedSanctionId, setHighlightedSanctionId] = useState<string | null>(null);
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

  const resetReportEvidencePreview = () => {
    setReportEvidencePreviewError(null);
    setReportEvidencePreview((currentPreview) => {
      if (currentPreview?.fileUrl) {
        URL.revokeObjectURL(currentPreview.fileUrl);
      }

      return null;
    });
  };

  const fetchReportEvidence = async (report: ReportRecord) => {
    if (!authSession) {
      throw new ApiError('No fue posible autenticar la descarga de la evidencia.', 401);
    }

    const blob = await downloadReportEvidence(authSession.accessToken, report.id);

    return {
      blob,
      fileName: buildReportEvidenceFileName(report, blob.type),
      title: `Evidencia del reporte de ${report.reportedFullName}`,
    };
  };

  const handleOpenReportEvidencePreview = async (report: ReportRecord) => {
    if (!authSession || !report.evidenceFileKey) {
      return;
    }

    setIsOpeningReportEvidenceId(report.id);
    setErrorMessage(null);
    setReportEvidencePreviewError(null);

    try {
      const { blob, fileName, title } = await fetchReportEvidence(report);
      const objectUrl = URL.createObjectURL(blob);

      setReportEvidencePreview((currentPreview) => {
        if (currentPreview?.fileUrl) {
          URL.revokeObjectURL(currentPreview.fileUrl);
        }

        return {
          reportId: report.id,
          fileName,
          fileUrl: objectUrl,
          mimeType: blob.type,
          title,
        };
      });
    } catch (error) {
      setReportEvidencePreviewError(
        getApiErrorMessage(
          error,
          'No fue posible abrir la previsualizacion de la evidencia del reporte.',
        ),
      );
    } finally {
      setIsOpeningReportEvidenceId(null);
    }
  };

  const handleDownloadReportEvidence = async (report: ReportRecord) => {
    if (!authSession || !report.evidenceFileKey) {
      return;
    }

    setIsDownloadingReportEvidenceId(report.id);
    setErrorMessage(null);

    try {
      const { blob, fileName } = await fetchReportEvidence(report);
      downloadBlobFile(blob, fileName);
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible descargar la evidencia del reporte.'),
      );
    } finally {
      setIsDownloadingReportEvidenceId(null);
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

  const openAuditWorkspace = (input: {
    workspace: AuditWorkspaceSection;
    reportId?: string | null;
    membershipId?: string | null;
    sanctionId?: string | null;
  }) => {
    setActiveWorkspace(input.workspace);
    setHighlightedReportId(input.reportId ?? null);
    setHighlightedMembershipId(input.membershipId ?? null);
    setHighlightedSanctionId(input.sanctionId ?? null);
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
  const reportsPendingCount = reviewableReports.filter(
    (report) => report.status === ReportStatus.Pending,
  ).length;
  const reportsUnderReviewCount = reviewableReports.filter(
    (report) => report.status === ReportStatus.UnderReview,
  ).length;
  const closedReportsCount = reviewableReports.filter(
    (report) =>
      report.status === ReportStatus.Resolved || report.status === ReportStatus.Dismissed,
  ).length;
  const highSeverityOpenReportsCount = reviewableReports.filter(
    (report) =>
      requiresDetailedReviewNote(report.reason) &&
      (report.status === ReportStatus.Pending || report.status === ReportStatus.UnderReview),
  ).length;
  const reportsWithEvidenceCount = reviewableReports.filter(
    (report) => Boolean(report.evidenceFileKey),
  ).length;
  const staleOpenReportsCount = reviewableReports.filter((report) => {
    const isOpenReport =
      report.status === ReportStatus.Pending || report.status === ReportStatus.UnderReview;

    return isOpenReport && getElapsedHours(report.createdAt) >= 24;
  }).length;
  const readyForDecisionReportsCount = reviewableReports.filter(
    (report) => report.status === ReportStatus.UnderReview,
  ).length;
  const orderedReviewableReports = useMemo(
    () =>
      [...reviewableReports].sort((left, right) => {
        const rankDifference = getReportPriorityRank(left) - getReportPriorityRank(right);

        if (rankDifference !== 0) {
          return rankDifference;
        }

        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      }),
    [reviewableReports],
  );
  const nextPriorityReport = orderedReviewableReports.find(
    (report) =>
      report.status === ReportStatus.Pending || report.status === ReportStatus.UnderReview,
  );
  const sanctionsByMembershipId = useMemo(() => {
    const groupedSanctions = new Map<string, ReviewableOperationalSanctionRecord[]>();

    reviewableSanctions.forEach((sanction) => {
      const currentItems = groupedSanctions.get(sanction.membershipId) ?? [];
      groupedSanctions.set(sanction.membershipId, [...currentItems, sanction]);
    });

    return groupedSanctions;
  }, [reviewableSanctions]);
  const appealsByMembershipId = useMemo(() => {
    const groupedAppeals = new Map<string, OperationalSanctionAppealRecord[]>();

    reviewableAppeals.forEach((appeal) => {
      const currentItems = groupedAppeals.get(appeal.membershipId) ?? [];
      groupedAppeals.set(appeal.membershipId, [...currentItems, appeal]);
    });

    return groupedAppeals;
  }, [reviewableAppeals]);
  const appealsBySanctionId = useMemo(() => {
    const groupedAppeals = new Map<string, OperationalSanctionAppealRecord[]>();

    reviewableAppeals.forEach((appeal) => {
      const currentItems = groupedAppeals.get(appeal.sanctionId) ?? [];
      groupedAppeals.set(appeal.sanctionId, [...currentItems, appeal]);
    });

    return groupedAppeals;
  }, [reviewableAppeals]);
  const automaticSanctionsCount = reviewableSanctions.filter((sanction) => sanction.isAutomatic).length;
  const temporarySanctionsCount = reviewableSanctions.filter((sanction) => sanction.endsAt).length;
  const indefiniteSanctionsCount = reviewableSanctions.filter((sanction) => !sanction.endsAt).length;
  const approvedAppealsCount = reviewableAppeals.filter(
    (appeal) => appeal.status === OperationalSanctionAppealStatus.Approved,
  ).length;
  const rejectedAppealsCount = reviewableAppeals.filter(
    (appeal) => appeal.status === OperationalSanctionAppealStatus.Rejected,
  ).length;
  const sanctionsWithPendingAppeals = new Set(
    reviewableAppeals
      .filter((appeal) => appeal.status === OperationalSanctionAppealStatus.Pending)
      .map((appeal) => appeal.sanctionId),
  );
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
            onClick={() => openAuditWorkspace({ workspace: 'reports' })}
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
            onClick={() => openAuditWorkspace({ workspace: 'driver' })}
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
            onClick={() => openAuditWorkspace({ workspace: 'events' })}
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
            onClick={() => openAuditWorkspace({ workspace: 'sanctions' })}
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
            onClick={() => openAuditWorkspace({ workspace: 'appeals' })}
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
                        Licencia: {application.licenseType.code} - {application.licenseType.name}
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
                            : 'Ver cédula'}
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
                            : 'Descargar cédula'}
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
            <AuditWorkspaceHero
              actions={
                <>
                  <StatusPill
                    label={
                      highSeverityOpenReportsCount
                        ? `${highSeverityOpenReportsCount} alta severidad`
                        : 'Sin alta severidad'
                    }
                    tone={highSeverityOpenReportsCount ? 'danger' : 'success'}
                  />
                  <StatusPill
                    label={`${reviewableReports.length} visibles`}
                    tone="neutral"
                  />
                </>
              }
              subtitle="Prioriza incidentes abiertos, mueve a revision los casos delicados y cierra cada decision con trazabilidad."
              title="Bandeja de reportes"
            />

            <div className="audit-mini-grid">
              <AuditMiniStat
                label="Pendientes"
                note="Listos para primer analisis."
                tone={reportsPendingCount ? 'warning' : 'neutral'}
                value={reportsPendingCount}
              />
              <AuditMiniStat
                label="En revision"
                note="Casos que ya requieren decision."
                tone={reportsUnderReviewCount ? 'neutral' : 'neutral'}
                value={reportsUnderReviewCount}
              />
              <AuditMiniStat
                label="Alta severidad"
                note="Exigen nota amplia antes del cierre."
                tone={highSeverityOpenReportsCount ? 'danger' : 'success'}
                value={highSeverityOpenReportsCount}
              />
              <AuditMiniStat
                label="Cerrados"
                note="Resueltos o desestimados."
                tone={closedReportsCount ? 'success' : 'neutral'}
                value={closedReportsCount}
              />
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

            <div className="audit-report-focus-grid">
              <article className="audit-report-focus-card audit-report-focus-card-danger">
                <span className="audit-report-focus-label">Atencion inmediata</span>
                <strong className="audit-report-focus-value">{highSeverityOpenReportsCount}</strong>
                <p className="audit-report-focus-note">
                  Alta severidad abierta.
                  {nextPriorityReport
                    ? ` Siguiente caso: ${nextPriorityReport.reportedFullName}.`
                    : ' Sin casos abiertos.'}
                </p>
              </article>
              <article className="audit-report-focus-card audit-report-focus-card-neutral">
                <span className="audit-report-focus-label">Listos para decision</span>
                <strong className="audit-report-focus-value">{readyForDecisionReportsCount}</strong>
                <p className="audit-report-focus-note">
                  Casos ya en revision que pueden cerrarse hoy.
                </p>
              </article>
              <article className="audit-report-focus-card audit-report-focus-card-warning">
                <span className="audit-report-focus-label">Abiertos por mas tiempo</span>
                <strong className="audit-report-focus-value">{staleOpenReportsCount}</strong>
                <p className="audit-report-focus-note">
                  Reportes abiertos por 24 h o mas.
                </p>
              </article>
              <article className="audit-report-focus-card audit-report-focus-card-success">
                <span className="audit-report-focus-label">Con evidencia</span>
                <strong className="audit-report-focus-value">{reportsWithEvidenceCount}</strong>
                <p className="audit-report-focus-note">
                  Casos con respaldo adjunto para revisar.
                </p>
              </article>
            </div>

            {reviewableReports.length ? (
              <div className="list-stack">
                {orderedReviewableReports.map((report) => {
                  const isHighSeverity = requiresDetailedReviewNote(report.reason);
                  const isOpenReport =
                    report.status === ReportStatus.Pending ||
                    report.status === ReportStatus.UnderReview;
                  const relatedSanctions =
                    sanctionsByMembershipId.get(report.reportedMembershipId) ?? [];
                  const relatedAppeals =
                    appealsByMembershipId.get(report.reportedMembershipId) ?? [];
                  const pendingRelatedAppeals = relatedAppeals.filter(
                    (appeal) => appeal.status === OperationalSanctionAppealStatus.Pending,
                  );
                  const reportTriggeredSanctions = relatedSanctions.filter(
                    (sanction) => sanction.trigger === OperationalSanctionTrigger.ResolvedReports,
                  );
                  const reportOutcomeSummary = deriveReportOutcomeSummary({
                    report,
                    reportTriggeredSanctionsCount: reportTriggeredSanctions.length,
                    pendingAppealsCount: pendingRelatedAppeals.length,
                    totalRelatedSanctionsCount: relatedSanctions.length,
                  });
                  const isHighlightedReport =
                    highlightedReportId === report.id ||
                    highlightedMembershipId === report.reportedMembershipId;
                  const noteLength = reviewNotes[report.id]?.trim().length ?? 0;
                  const requiresReviewTransition =
                    isHighSeverity && report.status === ReportStatus.Pending;
                  const meetsDetailedNoteRequirement =
                    noteLength >= HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH;
                  const canCloseReport =
                    Boolean(reviewNotes[report.id]?.trim()) &&
                    !requiresReviewTransition &&
                    (!isHighSeverity || meetsDetailedNoteRequirement);

                  return (
                    <div
                      key={report.id}
                      className={[
                        'list-card',
                        'audit-review-card',
                        isHighSeverity ? 'audit-review-card-danger' : '',
                        report.status === ReportStatus.UnderReview
                          ? 'audit-review-card-neutral'
                          : '',
                        report.status === ReportStatus.Resolved
                          ? 'audit-review-card-success'
                          : '',
                        isHighlightedReport ? 'audit-review-card-spotlight' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="audit-review-head">
                        <div className="audit-review-copy">
                          <strong>{report.reportedFullName}</strong>
                          <p className="audit-review-subline">
                            Reporta {report.reporterFullName} en {report.institutionName}
                          </p>
                        </div>
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

                      <div className="audit-review-facts">
                        <div className="audit-review-fact">
                          <span>Motivo</span>
                          <strong>{getReportReasonLabel(report.reason)}</strong>
                        </div>
                        <div className="audit-review-fact">
                          <span>Fecha</span>
                          <strong>{formatDateTime(report.createdAt)}</strong>
                        </div>
                        <div className="audit-review-fact">
                          <span>Antiguedad</span>
                          <strong>{formatRelativeElapsed(report.createdAt)}</strong>
                        </div>
                        <div className="audit-review-fact audit-review-fact-wide">
                          <span>Ruta</span>
                          <strong>
                            {report.tripOriginLabel} -&gt; {report.tripDestinationLabel}
                          </strong>
                        </div>
                      </div>

                      {report.description ? (
                        <div className="audit-note-banner">
                          <span>Descripcion</span>
                          <p>{report.description}</p>
                        </div>
                      ) : null}

                      <div className="audit-link-grid">
                        <article className="audit-link-card">
                          <span className="audit-link-card-label">Impacto disciplinario</span>
                          <strong className="audit-link-card-value">
                            {relatedSanctions.length
                              ? `${relatedSanctions.length} sancion(es)`
                              : 'Sin sancion activa'}
                          </strong>
                          <p className="audit-link-card-note">
                            {reportTriggeredSanctions.length
                              ? `${reportTriggeredSanctions.length} vinculada(s) a reportes resueltos.`
                              : 'Aun no hay sancion activa visible para esta persona.'}
                          </p>
                          {relatedSanctions.length ? (
                            <Button
                              onClick={() =>
                                openAuditWorkspace({
                                  workspace: 'sanctions',
                                  membershipId: report.reportedMembershipId,
                                })
                              }
                              variant="secondary"
                            >
                              Ver sanciones
                            </Button>
                          ) : null}
                        </article>
                        <article className="audit-link-card">
                          <span className="audit-link-card-label">Estado de apelacion</span>
                          <strong className="audit-link-card-value">
                            {pendingRelatedAppeals.length
                              ? `${pendingRelatedAppeals.length} pendiente(s)`
                              : relatedAppeals.length
                                ? `${relatedAppeals.length} cerrada(s)`
                                : 'Sin apelaciones'}
                          </strong>
                          <p className="audit-link-card-note">
                            {pendingRelatedAppeals.length
                              ? 'Hay revision disciplinaria abierta sobre esta persona.'
                              : 'No hay apelaciones pendientes asociadas a sus sanciones activas.'}
                          </p>
                          {relatedAppeals.length ? (
                            <Button
                              onClick={() =>
                                openAuditWorkspace({
                                  workspace: 'appeals',
                                  membershipId: report.reportedMembershipId,
                                  sanctionId: pendingRelatedAppeals[0]?.sanctionId ?? relatedAppeals[0]?.sanctionId ?? null,
                                })
                              }
                              variant="ghost"
                            >
                              Ver apelaciones
                            </Button>
                          ) : null}
                        </article>
                      </div>

                      <div
                        className={[
                          'audit-outcome-card',
                          `audit-outcome-card-${reportOutcomeSummary.tone}`,
                        ].join(' ')}
                      >
                        <span className="audit-outcome-label">Efecto operativo actual</span>
                        <strong className="audit-outcome-value">{reportOutcomeSummary.label}</strong>
                        <p className="audit-outcome-note">{reportOutcomeSummary.note}</p>
                      </div>

                      <div className="audit-inline-list">
                        {report.evidenceFileKey ? (
                          <>
                            <span className="audit-inline-chip">
                              Evidencia adjunta
                            </span>
                            <div className="button-row">
                              <Button
                                disabled={isOpeningReportEvidenceId === report.id}
                                onClick={() => void handleOpenReportEvidencePreview(report)}
                                variant="secondary"
                              >
                                {isOpeningReportEvidenceId === report.id
                                  ? 'Abriendo...'
                                  : 'Ver evidencia'}
                              </Button>
                              <Button
                                disabled={isDownloadingReportEvidenceId === report.id}
                                onClick={() => void handleDownloadReportEvidence(report)}
                                variant="ghost"
                              >
                                {isDownloadingReportEvidenceId === report.id
                                  ? 'Descargando...'
                                  : 'Descargar'}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <span className="audit-inline-chip audit-inline-chip-muted">
                            Sin evidencia adjunta
                          </span>
                        )}
                        {report.reviewNote ? (
                          <span className="audit-inline-chip">
                            Nota previa registrada
                          </span>
                        ) : null}
                        {report.status === ReportStatus.UnderReview ? (
                          <span className="audit-inline-chip audit-inline-chip-accent">
                            Listo para decidir
                          </span>
                        ) : null}
                        {isOpenReport && getElapsedHours(report.createdAt) >= 24 ? (
                          <span className="audit-inline-chip audit-inline-chip-warning">
                            Abierto por mas de 24 h
                          </span>
                        ) : null}
                      </div>

                      {report.reviewNote ? (
                        <div className="audit-note-banner audit-note-banner-muted">
                          <span>Nota de revision</span>
                          <p>{report.reviewNote}</p>
                        </div>
                      ) : null}

                      {isHighSeverity ? (
                        <div className="audit-priority-banner">
                          Requiere paso previo por revision y una nota minima de{' '}
                          {HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH} caracteres antes del cierre.
                        </div>
                      ) : null}

                      {isOpenReport ? (
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
                            <div className="audit-note-progress">
                              <div className="audit-note-progress-copy">
                                <span>{noteLength} caracteres</span>
                                <strong>
                                  {requiresReviewTransition
                                    ? 'Debe pasar primero a revision'
                                    : isHighSeverity
                                      ? meetsDetailedNoteRequirement
                                        ? 'Lista para cierre'
                                        : `Minimo ${HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH}`
                                      : noteLength > 0
                                        ? 'Lista para cierre'
                                        : 'Agrega una nota para decidir'}
                                </strong>
                              </div>
                              <div className="audit-note-progress-bar">
                                <span
                                  className={[
                                    'audit-note-progress-fill',
                                    canCloseReport
                                      ? 'audit-note-progress-fill-success'
                                      : requiresReviewTransition
                                        ? 'audit-note-progress-fill-warning'
                                        : 'audit-note-progress-fill-neutral',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      isHighSeverity
                                        ? (noteLength / HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH) *
                                            100
                                        : noteLength > 0
                                          ? 100
                                          : 0,
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
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
                                  !canCloseReport
                                }
                                onClick={() => void handleReviewReport(report.id, ReportStatus.Resolved)}
                              >
                                Resolver
                              </Button>
                              <Button
                                disabled={
                                  isReviewingReportId === report.id ||
                                  !canCloseReport
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
                        <div className="audit-resolution-note">
                          Cerrado por {report.reviewedByFullName ?? 'administracion'}.
                        </div>
                      )}
                    </div>
                  );
                })}
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
            <AuditWorkspaceHero
              actions={
                <>
                  <StatusPill
                    label={
                      sanctionsWithPendingAppeals.size
                        ? `${sanctionsWithPendingAppeals.size} con apelacion`
                        : 'Sin apelaciones activas'
                    }
                    tone={sanctionsWithPendingAppeals.size ? 'warning' : 'success'}
                  />
                  <StatusPill
                    label={`${reviewableSanctions.length} activas`}
                    tone="neutral"
                  />
                </>
              }
              subtitle="Controla sanciones vigentes, distingue las automaticas y registra con nota cualquier levantamiento manual."
              title="Sanciones activas"
            />

            <div className="audit-mini-grid">
              <AuditMiniStat
                label="Automaticas"
                note="Generadas por reglas operativas."
                tone={automaticSanctionsCount ? 'warning' : 'neutral'}
                value={automaticSanctionsCount}
              />
              <AuditMiniStat
                label="Temporales"
                note="Con fecha estimada de cierre."
                tone={temporarySanctionsCount ? 'neutral' : 'neutral'}
                value={temporarySanctionsCount}
              />
              <AuditMiniStat
                label="Indefinidas"
                note="Requieren seguimiento manual."
                tone={indefiniteSanctionsCount ? 'danger' : 'success'}
                value={indefiniteSanctionsCount}
              />
              <AuditMiniStat
                label="Con apelacion"
                note="Sanciones que hoy ya tienen revision pendiente."
                tone={sanctionsWithPendingAppeals.size ? 'warning' : 'success'}
                value={sanctionsWithPendingAppeals.size}
              />
            </div>

            {reviewableSanctions.length ? (
              <div className="list-stack">
                {reviewableSanctions.map((sanction) => {
                  const hasPendingAppeal = sanctionsWithPendingAppeals.has(sanction.id);
                  const relatedAppealsForSanction = appealsBySanctionId.get(sanction.id) ?? [];
                  const sanctionOutcomeSummary = deriveSanctionOutcomeSummary(
                    sanction,
                    relatedAppealsForSanction.filter(
                      (appeal) => appeal.status === OperationalSanctionAppealStatus.Pending,
                    ).length,
                  );
                  const sanctionThreshold =
                    typeof sanction.metadata?.threshold === 'number'
                      ? sanction.metadata.threshold
                      : null;
                  const sanctionEventCount =
                    typeof sanction.metadata?.eventCount === 'number'
                      ? sanction.metadata.eventCount
                      : null;
                  const isHighlightedSanction =
                    highlightedSanctionId === sanction.id ||
                    highlightedMembershipId === sanction.membershipId;

                  return (
                    <div
                      key={sanction.id}
                      className={[
                        'list-card',
                        'audit-review-card',
                        hasPendingAppeal ? 'audit-review-card-warning' : '',
                        !sanction.endsAt ? 'audit-review-card-danger' : '',
                        isHighlightedSanction ? 'audit-review-card-spotlight' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="audit-review-head">
                        <div className="audit-review-copy">
                          <strong>{sanction.membershipUserFullName}</strong>
                          <p className="audit-review-subline">{sanction.institutionName}</p>
                        </div>
                        <div className="button-row">
                          <StatusPill
                            label={getOperationalSanctionTypeLabel(sanction.type)}
                            tone={getOperationalSanctionTone(sanction.type)}
                          />
                          <StatusPill
                            label={getOperationalSanctionScopeLabel(sanction.scope)}
                            tone="neutral"
                          />
                          {hasPendingAppeal ? (
                            <StatusPill label="Apelacion pendiente" tone="warning" />
                          ) : null}
                        </div>
                      </div>

                      <div className="audit-review-facts">
                        <div className="audit-review-fact">
                          <span>Inicio</span>
                          <strong>{formatDateTime(sanction.startedAt)}</strong>
                        </div>
                        <div className="audit-review-fact">
                          <span>Fin</span>
                          <strong>
                            {sanction.endsAt ? formatDateTime(sanction.endsAt) : 'Indefinida'}
                          </strong>
                        </div>
                        <div className="audit-review-fact">
                          <span>Origen</span>
                          <strong>{sanction.isAutomatic ? 'Automatica' : 'Manual'}</strong>
                        </div>
                        <div className="audit-review-fact audit-review-fact-wide">
                          <span>Disparador</span>
                          <strong>{getOperationalSanctionTriggerLabel(sanction.trigger)}</strong>
                        </div>
                      </div>

                      <div className="audit-note-banner">
                        <span>Motivo</span>
                        <p>{sanction.reason}</p>
                      </div>

                      <div className="audit-link-grid">
                        <article className="audit-link-card">
                          <span className="audit-link-card-label">Consecuencia operativa</span>
                          <strong className="audit-link-card-value">
                            {getOperationalSanctionTypeLabel(sanction.type)}
                          </strong>
                          <p className="audit-link-card-note">
                            Afecta el alcance {getOperationalSanctionScopeLabel(sanction.scope).toLowerCase()}.
                          </p>
                        </article>
                        <article className="audit-link-card">
                          <span className="audit-link-card-label">Rastros del caso</span>
                          <strong className="audit-link-card-value">
                            {sanctionEventCount !== null
                              ? `${sanctionEventCount} evento(s)`
                              : 'Sin detalle numerico'}
                          </strong>
                          <p className="audit-link-card-note">
                            {sanctionThreshold !== null
                              ? `Umbral aplicado: ${sanctionThreshold}.`
                              : 'No hay umbral registrado en metadatos.'}
                          </p>
                        </article>
                      </div>

                      <div className="audit-inline-list">
                        {sanction.trigger === OperationalSanctionTrigger.ResolvedReports ? (
                          <span className="audit-inline-chip audit-inline-chip-danger">
                            Derivada de reportes resueltos
                          </span>
                        ) : null}
                        {relatedAppealsForSanction.length ? (
                          <span className="audit-inline-chip audit-inline-chip-warning">
                            {relatedAppealsForSanction.length} apelacion(es) vinculada(s)
                          </span>
                        ) : null}
                      </div>

                      <div className="button-row">
                        {sanction.trigger === OperationalSanctionTrigger.ResolvedReports ? (
                          <Button
                            onClick={() =>
                              openAuditWorkspace({
                                workspace: 'reports',
                                membershipId: sanction.membershipId,
                              })
                            }
                            variant="secondary"
                          >
                            Ver reportes vinculados
                          </Button>
                        ) : null}
                        {relatedAppealsForSanction.length ? (
                          <Button
                            onClick={() =>
                              openAuditWorkspace({
                                workspace: 'appeals',
                                membershipId: sanction.membershipId,
                                sanctionId: sanction.id,
                              })
                            }
                            variant="ghost"
                          >
                            Ver apelaciones
                          </Button>
                        ) : null}
                      </div>

                      <div
                        className={[
                          'audit-outcome-card',
                          `audit-outcome-card-${sanctionOutcomeSummary.tone}`,
                        ].join(' ')}
                      >
                        <span className="audit-outcome-label">Efecto operativo actual</span>
                        <strong className="audit-outcome-value">{sanctionOutcomeSummary.label}</strong>
                        <p className="audit-outcome-note">{sanctionOutcomeSummary.note}</p>
                      </div>

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
                  );
                })}
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
            <AuditWorkspaceHero
              actions={
                <>
                  <StatusPill
                    label={
                      pendingAppealsCount
                        ? `${pendingAppealsCount} pendientes`
                        : 'Sin pendientes'
                    }
                    tone={pendingAppealsCount ? 'warning' : 'success'}
                  />
                  <StatusPill
                    label={`${reviewableAppeals.length} visibles`}
                    tone="neutral"
                  />
                </>
              }
              subtitle="Resuelve solicitudes de revision con criterio consistente y una nota administrativa clara para cada decision."
              title="Apelaciones de sanciones"
            />

            <div className="audit-mini-grid">
              <AuditMiniStat
                label="Pendientes"
                note="Necesitan revision administrativa."
                tone={pendingAppealsCount ? 'warning' : 'success'}
                value={pendingAppealsCount}
              />
              <AuditMiniStat
                label="Aprobadas"
                note="Apelaciones aceptadas."
                tone={approvedAppealsCount ? 'success' : 'neutral'}
                value={approvedAppealsCount}
              />
              <AuditMiniStat
                label="Rechazadas"
                note="Casos ya cerrados en contra."
                tone={rejectedAppealsCount ? 'danger' : 'neutral'}
                value={rejectedAppealsCount}
              />
              <AuditMiniStat
                label="Sanciones activas"
                note="Contexto del frente disciplinario."
                tone={reviewableSanctions.length ? 'neutral' : 'neutral'}
                value={reviewableSanctions.length}
              />
            </div>

            {reviewableAppeals.length ? (
              <div className="list-stack">
                {reviewableAppeals.map((appeal) => {
                  const isPending = appeal.status === OperationalSanctionAppealStatus.Pending;
                  const appealOutcomeSummary = deriveAppealOutcomeSummary(appeal);
                  const isHighlightedAppeal =
                    highlightedSanctionId === appeal.sanctionId ||
                    highlightedMembershipId === appeal.membershipId;

                  return (
                    <div
                      key={appeal.id}
                      className={[
                        'list-card',
                        'audit-review-card',
                        isPending ? 'audit-review-card-warning' : '',
                        appeal.status === OperationalSanctionAppealStatus.Approved
                          ? 'audit-review-card-success'
                          : '',
                        isHighlightedAppeal ? 'audit-review-card-spotlight' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="audit-review-head">
                        <div className="audit-review-copy">
                          <strong>{appeal.affectedFullName}</strong>
                          <p className="audit-review-subline">
                            Solicita revision {appeal.requestedByFullName}
                          </p>
                        </div>
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

                      <div className="audit-review-facts">
                        <div className="audit-review-fact">
                          <span>Institucion</span>
                          <strong>{appeal.institutionName}</strong>
                        </div>
                        <div className="audit-review-fact">
                          <span>Alcance</span>
                          <strong>{getOperationalSanctionScopeLabel(appeal.sanctionScope)}</strong>
                        </div>
                        <div className="audit-review-fact">
                          <span>Sancion</span>
                          <strong>
                            {appeal.sanctionEndsAt
                              ? `Hasta ${formatDateTime(appeal.sanctionEndsAt)}`
                              : 'Indefinida'}
                          </strong>
                        </div>
                        <div className="audit-review-fact audit-review-fact-wide">
                          <span>Disparador</span>
                          <strong>{getOperationalSanctionTriggerLabel(appeal.sanctionTrigger)}</strong>
                        </div>
                      </div>

                      <div className="audit-note-banner">
                        <span>Apelacion</span>
                        <p>{appeal.reason}</p>
                      </div>

                      <div className="audit-note-banner audit-note-banner-muted">
                        <span>Sancion original</span>
                        <p>{appeal.sanctionReason}</p>
                      </div>

                      <div className="audit-link-grid">
                        <article className="audit-link-card">
                          <span className="audit-link-card-label">Frente disciplinario</span>
                          <strong className="audit-link-card-value">
                            {getOperationalSanctionTypeLabel(appeal.sanctionType)}
                          </strong>
                          <p className="audit-link-card-note">
                            Impacta el alcance {getOperationalSanctionScopeLabel(appeal.sanctionScope).toLowerCase()}.
                          </p>
                        </article>
                        <article className="audit-link-card">
                          <span className="audit-link-card-label">Origen de la sancion</span>
                          <strong className="audit-link-card-value">
                            {getOperationalSanctionTriggerLabel(appeal.sanctionTrigger)}
                          </strong>
                          <p className="audit-link-card-note">
                            {appeal.sanctionTrigger === OperationalSanctionTrigger.ResolvedReports
                              ? 'Proviene de reportes administrativos ya resueltos.'
                              : 'Proviene de reglas operativas automáticas.'}
                          </p>
                        </article>
                      </div>

                      <div className="button-row">
                        <Button
                          onClick={() =>
                            openAuditWorkspace({
                              workspace: 'sanctions',
                              membershipId: appeal.membershipId,
                              sanctionId: appeal.sanctionId,
                            })
                          }
                          variant="secondary"
                        >
                          Ver sancion
                        </Button>
                        {appeal.sanctionTrigger === OperationalSanctionTrigger.ResolvedReports ? (
                          <Button
                            onClick={() =>
                              openAuditWorkspace({
                                workspace: 'reports',
                                membershipId: appeal.membershipId,
                              })
                            }
                            variant="ghost"
                          >
                            Ver reportes relacionados
                          </Button>
                        ) : null}
                      </div>

                      <div
                        className={[
                          'audit-outcome-card',
                          `audit-outcome-card-${appealOutcomeSummary.tone}`,
                        ].join(' ')}
                      >
                        <span className="audit-outcome-label">Efecto operativo actual</span>
                        <strong className="audit-outcome-value">{appealOutcomeSummary.label}</strong>
                        <p className="audit-outcome-note">{appealOutcomeSummary.note}</p>
                      </div>

                      {appeal.reviewNote ? (
                        <div className="audit-note-banner audit-note-banner-muted">
                          <span>Nota de revision</span>
                          <p>{appeal.reviewNote}</p>
                        </div>
                      ) : null}

                      {isPending ? (
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
                        <div className="audit-resolution-note">
                          Cerrada por {appeal.reviewedByFullName ?? 'administracion'}.
                        </div>
                      )}
                    </div>
                  );
                })}
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

      <FilePreviewModal
        description={
          reportEvidencePreview?.mimeType?.startsWith('image/')
            ? 'Inspecciona la imagen antes de tomar una decision administrativa sobre el caso.'
            : 'Revisa el archivo adjunto antes de cerrar o escalar el reporte.'
        }
        errorMessage={reportEvidencePreviewError}
        fileName={reportEvidencePreview?.fileName ?? null}
        fileUrl={reportEvidencePreview?.fileUrl ?? null}
        isDownloading={
          reportEvidencePreview
            ? isDownloadingReportEvidenceId === reportEvidencePreview.reportId
            : false
        }
        isLoading={Boolean(isOpeningReportEvidenceId)}
        isOpen={Boolean(reportEvidencePreview) || Boolean(reportEvidencePreviewError)}
        mimeType={reportEvidencePreview?.mimeType ?? null}
        onClose={resetReportEvidencePreview}
        onDownload={
          reportEvidencePreview
            ? () => {
                const report = reviewableReports.find(
                  (item) => item.id === reportEvidencePreview.reportId,
                );

                if (report) {
                  void handleDownloadReportEvidence(report);
                }
              }
            : undefined
        }
        title={reportEvidencePreview?.title ?? 'Evidencia del reporte'}
      />
    </>
  );
}
