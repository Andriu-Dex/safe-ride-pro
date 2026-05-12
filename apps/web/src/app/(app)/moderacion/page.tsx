'use client';

import {
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
  OperationalSanctionAppealStatus,
  OperationalSanctionTrigger,
  ReportStatus,
} from '@saferidepro/shared-types';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { downloadBlobFile, getFileExtensionFromMimeType } from '../../../lib/blob-file';
import { ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
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
import type {
  DriverDocumentType,
  ReviewableDriverApplicationRecord,
} from '../../../modules/driver/types/driver';
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
import {
  getOperationalSanctionScopeLabel,
  getOperationalSanctionTone,
  getOperationalSanctionTypeLabel,
} from '../../../modules/users/lib/trust-labels';
import {
  DriverDocumentPreviewState,
  ModerationModals,
  ReportEvidencePreviewState,
} from './components/moderation-modals';
import {
  InlineIcon,
  ModerationWorkspaceSection,
  StatChip,
} from './components/moderation-support';
import styles from './page.module.css';

const INITIAL_PAGES: Record<ModerationWorkspaceSection, number> = {
  driver: 1,
  reports: 1,
  sanctions: 1,
  appeals: 1,
};

const PAGE_SIZES: Record<ModerationWorkspaceSection, number> = {
  driver: 6,
  reports: 5,
  sanctions: 5,
  appeals: 5,
};

type ModerationSortOption =
  | 'newest'
  | 'oldest'
  | 'priority-recent'
  | 'license-expiring'
  | 'name-asc'
  | 'severity-first'
  | 'expires-soon'
  | 'automatic-first'
  | 'pending-first';

const DEFAULT_SORT_BY_WORKSPACE: Record<ModerationWorkspaceSection, ModerationSortOption> = {
  driver: 'newest',
  reports: 'priority-recent',
  sanctions: 'newest',
  appeals: 'newest',
};

function isModerationWorkspaceSection(
  value: string | null,
): value is ModerationWorkspaceSection {
  return value === 'driver' || value === 'reports' || value === 'sanctions' || value === 'appeals';
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

  return `${Math.floor(elapsedHours / 24)} d`;
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsedValue = new Date(value).getTime();
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
}

function isWithinDateRange(
  value: string | null | undefined,
  fromDate: string,
  toDate: string,
): boolean {
  if (!value) {
    return false;
  }

  const valueTimestamp = toTimestamp(value);

  if (!valueTimestamp) {
    return false;
  }

  if (fromDate) {
    const fromTimestamp = toTimestamp(`${fromDate}T00:00:00`);

    if (fromTimestamp && valueTimestamp < fromTimestamp) {
      return false;
    }
  }

  if (toDate) {
    const toTimestampValue = toTimestamp(`${toDate}T23:59:59.999`);

    if (toTimestampValue && valueTimestamp > toTimestampValue) {
      return false;
    }
  }

  return true;
}

function compareAscendingDates(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  return toTimestamp(left) - toTimestamp(right);
}

function compareDescendingDates(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  return toTimestamp(right) - toTimestamp(left);
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

function buildReportEvidenceFileName(report: ReportRecord, mimeType: string): string {
  const safeName = report.reportedFullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return `reporte-${safeName || 'evidencia'}-${report.id.slice(0, 8)}.${getFileExtensionFromMimeType(mimeType)}`;
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

export default function ModerationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authSession, isHydrated, refreshSession } = useAuth();

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
  const [institutionId, setInstitutionId] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('');
  const [driverApplicationStatusFilter, setDriverApplicationStatusFilter] = useState('');
  const [reportSeverityFilter, setReportSeverityFilter] = useState('');
  const [sanctionSourceFilter, setSanctionSourceFilter] = useState('');
  const [appealStatusFilter, setAppealStatusFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sortByWorkspace, setSortByWorkspace] = useState<
    Record<ModerationWorkspaceSection, ModerationSortOption>
  >(DEFAULT_SORT_BY_WORKSPACE);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [driverReviewNotes, setDriverReviewNotes] = useState<Record<string, string>>({});
  const [appealReviewNotes, setAppealReviewNotes] = useState<Record<string, string>>({});
  const [sanctionLiftNotes, setSanctionLiftNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isReviewingReportId, setIsReviewingReportId] = useState<string | null>(null);
  const [isReviewingDriverMembershipId, setIsReviewingDriverMembershipId] =
    useState<string | null>(null);
  const [isDownloadingDriverDocumentKey, setIsDownloadingDriverDocumentKey] =
    useState<string | null>(null);
  const [isOpeningDriverDocumentKey, setIsOpeningDriverDocumentKey] =
    useState<string | null>(null);
  const [isReviewingAppealId, setIsReviewingAppealId] = useState<string | null>(null);
  const [isLiftingSanctionId, setIsLiftingSanctionId] = useState<string | null>(null);
  const [driverDocumentPreview, setDriverDocumentPreview] =
    useState<DriverDocumentPreviewState | null>(null);
  const [driverDocumentPreviewError, setDriverDocumentPreviewError] =
    useState<string | null>(null);
  const [reportEvidencePreview, setReportEvidencePreview] =
    useState<ReportEvidencePreviewState | null>(null);
  const [reportEvidencePreviewError, setReportEvidencePreviewError] =
    useState<string | null>(null);
  const [isOpeningReportEvidenceId, setIsOpeningReportEvidenceId] =
    useState<string | null>(null);
  const [isDownloadingReportEvidenceId, setIsDownloadingReportEvidenceId] =
    useState<string | null>(null);
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);
  const [highlightedMembershipId, setHighlightedMembershipId] = useState<string | null>(null);
  const [highlightedSanctionId, setHighlightedSanctionId] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] =
    useState<ModerationWorkspaceSection>('driver');
  const [pageByWorkspace, setPageByWorkspace] =
    useState<Record<ModerationWorkspaceSection, number>>(INITIAL_PAGES);
  const [activeDriverApplication, setActiveDriverApplication] =
    useState<ReviewableDriverApplicationRecord | null>(null);
  const [activeReport, setActiveReport] = useState<ReportRecord | null>(null);
  const [activeSanction, setActiveSanction] =
    useState<ReviewableOperationalSanctionRecord | null>(null);
  const [activeAppeal, setActiveAppeal] =
    useState<OperationalSanctionAppealRecord | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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
      (authSession.user.globalRole === GlobalUserRole.SuperAdmin ||
        adminMemberships.length > 0),
  );

  const institutionOptions = adminMemberships.map((membership) => ({
    id: membership.institutionId,
    name: membership.institutionName,
  }));

  const pushToast = (
    title: string,
    description: string,
    tone: ToastItem['tone'] = 'info',
  ) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `moderation-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  };

  const loadData = async (accessToken: string) => {
    const [reportItems, driverApplicationItems, sanctionItems, appealItems] =
      await Promise.all([
        listReviewableReports(accessToken, {
          institutionId: institutionId || undefined,
          status: reportStatusFilter ? (reportStatusFilter as ReportStatus) : undefined,
          limit: 100,
        }),
        listReviewableDriverApplications(accessToken, {
          institutionId: institutionId || undefined,
          status: driverApplicationStatusFilter || undefined,
          limit: 100,
        }),
        listReviewableActiveSanctions(accessToken, {
          institutionId: institutionId || undefined,
          limit: 100,
        }),
        listReviewableSanctionAppeals(accessToken, {
          institutionId: institutionId || undefined,
          limit: 100,
        }),
      ]);

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
      await loadData(authSession.accessToken);

      if (showSpinner) {
        pushToast('Moderacion actualizada', 'Las bandejas administrativas ya estan al dia.', 'success');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo actualizar',
        getApiErrorMessage(error, 'No fue posible sincronizar la moderacion.'),
        'error',
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

    if (!authSession || !canAccessAdminView) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      setIsLoading(true);

      try {
        await loadData(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        pushToast(
          'No se pudo cargar',
          getApiErrorMessage(error, 'No fue posible cargar las bandejas de moderacion.'),
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
  }, [
    authSession,
    canAccessAdminView,
    driverApplicationStatusFilter,
    institutionId,
    isHydrated,
    refreshSession,
    reportStatusFilter,
  ]);

  useAutoRefresh(
    async () => {
      await refreshData();
    },
    {
      enabled: Boolean(authSession && isHydrated && canAccessAdminView),
      intervalMs: 25_000,
    },
  );

  useEffect(() => {
    const requestedSection = searchParams.get('section');
    const membershipId = searchParams.get('membershipId');
    const reportId = searchParams.get('reportId');
    const sanctionId = searchParams.get('sanctionId');

    if (isModerationWorkspaceSection(requestedSection)) {
      setActiveWorkspace(requestedSection);
    }

    setHighlightedMembershipId(membershipId);
    setHighlightedReportId(reportId);
    setHighlightedSanctionId(sanctionId);
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (driverDocumentPreview?.fileUrl) {
        URL.revokeObjectURL(driverDocumentPreview.fileUrl);
      }
      if (reportEvidencePreview?.fileUrl) {
        URL.revokeObjectURL(reportEvidencePreview.fileUrl);
      }
    };
  }, [driverDocumentPreview, reportEvidencePreview]);

  const openWorkspace = (workspace: ModerationWorkspaceSection, extras?: Record<string, string>) => {
    setActiveWorkspace(workspace);
    setPageByWorkspace((current) => ({ ...current, [workspace]: 1 }));

    const params = new URLSearchParams();
    params.set('section', workspace);

    if (extras) {
      Object.entries(extras).forEach(([key, value]) => params.set(key, value));
    }

    router.replace(`/moderacion?${params.toString()}`, { scroll: false });
  };

  const handleResetFilters = () => {
    setInstitutionId('');
    setReportStatusFilter('');
    setDriverApplicationStatusFilter('');
    setReportSeverityFilter('');
    setSanctionSourceFilter('');
    setAppealStatusFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setSortByWorkspace(DEFAULT_SORT_BY_WORKSPACE);
    setPageByWorkspace(INITIAL_PAGES);
  };

  const handleReviewNoteChange = (reportId: string, value: string) => {
    setReviewNotes((current) => ({ ...current, [reportId]: value }));
  };

  const handleDriverReviewNoteChange = (membershipId: string, value: string) => {
    setDriverReviewNotes((current) => ({ ...current, [membershipId]: value }));
  };

  const handleAppealReviewNoteChange = (appealId: string, value: string) => {
    setAppealReviewNotes((current) => ({ ...current, [appealId]: value }));
  };

  const handleSanctionLiftNoteChange = (sanctionId: string, value: string) => {
    setSanctionLiftNotes((current) => ({ ...current, [sanctionId]: value }));
  };

  const handleReviewReport = async (reportId: string, status: ReportStatus) => {
    if (!authSession) {
      return;
    }

    const note = reviewNotes[reportId]?.trim();

    if (status !== ReportStatus.UnderReview && !note) {
      pushToast('Falta una nota', 'Debes indicar una nota administrativa antes de cerrar el reporte.', 'info');
      return;
    }

    setIsReviewingReportId(reportId);

    try {
      const response = await reviewReport(authSession.accessToken, reportId, {
        status,
        reviewNote: note || undefined,
      });

      await loadData(authSession.accessToken);
      pushToast('Reporte actualizado', response.message, 'success');
      setActiveReport((current) => (current?.id === reportId ? null : current));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo actualizar',
        getApiErrorMessage(error, 'No fue posible actualizar el reporte.'),
        'error',
      );
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

    const reviewNotes = driverReviewNotes[membershipId]?.trim();

    if (decision === DriverVerificationStatus.Rejected && !reviewNotes) {
      pushToast('Falta una nota', 'Debes indicar la razon del rechazo.', 'info');
      return;
    }

    setIsReviewingDriverMembershipId(membershipId);

    try {
      const response = await reviewDriverApplication(authSession.accessToken, membershipId, {
        decision,
        reviewNotes: reviewNotes || undefined,
      });

      await loadData(authSession.accessToken);
      pushToast('Solicitud actualizada', response.message, 'success');
      setActiveDriverApplication((current) => (current?.membershipId === membershipId ? null : current));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo revisar',
        getApiErrorMessage(error, 'No fue posible revisar la solicitud.'),
        'error',
      );
    } finally {
      setIsReviewingDriverMembershipId(null);
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

    if ((reviewNote?.length ?? 0) < SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH) {
      pushToast(
        'Falta una nota',
        `La nota debe tener al menos ${SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH} caracteres.`,
        'info',
      );
      return;
    }

    setIsReviewingAppealId(appealId);

    try {
      const response = await reviewSanctionAppeal(authSession.accessToken, appealId, {
        status,
        reviewNote,
      });

      await loadData(authSession.accessToken);
      pushToast('Apelacion actualizada', response.message, 'success');
      setActiveAppeal((current) => (current?.id === appealId ? null : current));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo revisar',
        getApiErrorMessage(error, 'No fue posible revisar la apelacion.'),
        'error',
      );
    } finally {
      setIsReviewingAppealId(null);
    }
  };

  const handleLiftSanction = async (sanctionId: string) => {
    if (!authSession) {
      return;
    }

    const reviewNote = sanctionLiftNotes[sanctionId]?.trim();

    if ((reviewNote?.length ?? 0) < MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH) {
      pushToast(
        'Falta una nota',
        `La nota debe tener al menos ${MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH} caracteres.`,
        'info',
      );
      return;
    }

    setIsLiftingSanctionId(sanctionId);

    try {
      const response = await liftOperationalSanction(authSession.accessToken, sanctionId, {
        reviewNote,
      });

      await loadData(authSession.accessToken);
      pushToast('Sancion levantada', response.message, 'success');
      setActiveSanction((current) => (current?.id === sanctionId ? null : current));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo levantar',
        getApiErrorMessage(error, 'No fue posible levantar la sancion.'),
        'error',
      );
    } finally {
      setIsLiftingSanctionId(null);
    }
  };

  const handleOpenDriverDocumentPreview = async (
    membershipId: string,
    documentType: DriverDocumentType,
    userFullName: string,
  ) => {
    if (!authSession) {
      return;
    }

    const documentKey = `${membershipId}-${documentType}`;
    setIsOpeningDriverDocumentKey(documentKey);
    setDriverDocumentPreviewError(null);

    try {
      const blob = await downloadDriverApplicationDocument(
        authSession.accessToken,
        membershipId,
        documentType,
      );

      setDriverDocumentPreview((current) => {
        if (current?.fileUrl) {
          URL.revokeObjectURL(current.fileUrl);
        }

        return {
          membershipId,
          documentType,
          fileName: buildDriverDocumentFileName(documentType, userFullName, blob.type),
          fileUrl: URL.createObjectURL(blob),
          mimeType: blob.type,
          title: documentType === 'identity' ? 'Cedula del conductor' : 'Licencia del conductor',
        };
      });
    } catch (error) {
      setDriverDocumentPreviewError(
        getApiErrorMessage(error, 'No fue posible abrir el documento del conductor.'),
      );
    } finally {
      setIsOpeningDriverDocumentKey(null);
    }
  };

  const handleDownloadDriverDocument = async (
    membershipId: string,
    documentType: DriverDocumentType,
    userFullName: string,
  ) => {
    if (!authSession) {
      return;
    }

    const documentKey = `${membershipId}-${documentType}`;
    setIsDownloadingDriverDocumentKey(documentKey);

    try {
      const blob = await downloadDriverApplicationDocument(
        authSession.accessToken,
        membershipId,
        documentType,
      );

      downloadBlobFile(
        blob,
        buildDriverDocumentFileName(documentType, userFullName, blob.type),
      );
    } catch (error) {
      pushToast(
        'No se pudo descargar',
        getApiErrorMessage(error, 'No fue posible descargar el documento del conductor.'),
        'error',
      );
    } finally {
      setIsDownloadingDriverDocumentKey(null);
    }
  };

  const handleOpenReportEvidencePreview = async (report: ReportRecord) => {
    if (!authSession) {
      return;
    }

    setIsOpeningReportEvidenceId(report.id);
    setReportEvidencePreviewError(null);

    try {
      const blob = await downloadReportEvidence(authSession.accessToken, report.id);

      setReportEvidencePreview((current) => {
        if (current?.fileUrl) {
          URL.revokeObjectURL(current.fileUrl);
        }

        return {
          reportId: report.id,
          fileName: buildReportEvidenceFileName(report, blob.type),
          fileUrl: URL.createObjectURL(blob),
          mimeType: blob.type,
          title: 'Evidencia del reporte',
        };
      });
    } catch (error) {
      setReportEvidencePreviewError(
        getApiErrorMessage(error, 'No fue posible abrir la evidencia del reporte.'),
      );
    } finally {
      setIsOpeningReportEvidenceId(null);
    }
  };

  const handleDownloadReportEvidence = async (report: ReportRecord) => {
    if (!authSession) {
      return;
    }

    setIsDownloadingReportEvidenceId(report.id);

    try {
      const blob = await downloadReportEvidence(authSession.accessToken, report.id);
      downloadBlobFile(blob, buildReportEvidenceFileName(report, blob.type));
    } catch (error) {
      pushToast(
        'No se pudo descargar',
        getApiErrorMessage(error, 'No fue posible descargar la evidencia del reporte.'),
        'error',
      );
    } finally {
      setIsDownloadingReportEvidenceId(null);
    }
  };

  const resetDriverDocumentPreview = () => {
    setDriverDocumentPreview((current) => {
      if (current?.fileUrl) {
        URL.revokeObjectURL(current.fileUrl);
      }
      return null;
    });
    setDriverDocumentPreviewError(null);
  };

  const resetReportEvidencePreview = () => {
    setReportEvidencePreview((current) => {
      if (current?.fileUrl) {
        URL.revokeObjectURL(current.fileUrl);
      }
      return null;
    });
    setReportEvidencePreviewError(null);
  };

  useEffect(() => {
    setPageByWorkspace((current) => ({
      ...current,
      [activeWorkspace]: 1,
    }));
  }, [
    activeWorkspace,
    appealStatusFilter,
    dateFromFilter,
    dateToFilter,
    driverApplicationStatusFilter,
    institutionId,
    reportSeverityFilter,
    reportStatusFilter,
    sanctionSourceFilter,
    sortByWorkspace,
  ]);

  const activeFiltersCount = [
    institutionId,
    reportStatusFilter,
    driverApplicationStatusFilter,
    reportSeverityFilter,
    sanctionSourceFilter,
    appealStatusFilter,
    dateFromFilter,
    dateToFilter,
    sortByWorkspace[activeWorkspace] !== DEFAULT_SORT_BY_WORKSPACE[activeWorkspace]
      ? sortByWorkspace[activeWorkspace]
      : '',
  ].filter(Boolean).length;

  const filteredDriverApplications = useMemo(() => {
    const items = reviewableDriverApplications.filter((application) =>
      isWithinDateRange(application.submittedAt, dateFromFilter, dateToFilter),
    );

    return [...items].sort((left, right) => {
      switch (sortByWorkspace.driver) {
        case 'oldest':
          return compareAscendingDates(left.submittedAt, right.submittedAt);
        case 'license-expiring':
          return compareAscendingDates(left.licenseExpiresAt, right.licenseExpiresAt);
        case 'name-asc':
          return left.userFullName.localeCompare(right.userFullName, 'es');
        case 'newest':
        default:
          return compareDescendingDates(left.submittedAt, right.submittedAt);
      }
    });
  }, [dateFromFilter, dateToFilter, reviewableDriverApplications, sortByWorkspace.driver]);

  const orderedReviewableReports = useMemo(() => {
    const items = reviewableReports.filter((report) => {
      if (!isWithinDateRange(report.createdAt, dateFromFilter, dateToFilter)) {
        return false;
      }

      if (reportSeverityFilter === 'high') {
        return requiresDetailedReviewNote(report.reason);
      }

      if (reportSeverityFilter === 'regular') {
        return !requiresDetailedReviewNote(report.reason);
      }

      return true;
    });

    return [...items].sort((left, right) => {
      switch (sortByWorkspace.reports) {
        case 'newest':
          return compareDescendingDates(left.createdAt, right.createdAt);
        case 'oldest':
          return compareAscendingDates(left.createdAt, right.createdAt);
        case 'severity-first': {
          const severityDifference =
            Number(requiresDetailedReviewNote(right.reason)) -
            Number(requiresDetailedReviewNote(left.reason));

          return severityDifference || compareDescendingDates(left.createdAt, right.createdAt);
        }
        case 'priority-recent':
        default: {
          const priorityDifference = getReportPriorityRank(left) - getReportPriorityRank(right);
          return priorityDifference || compareDescendingDates(left.createdAt, right.createdAt);
        }
      }
    });
  }, [dateFromFilter, dateToFilter, reportSeverityFilter, reviewableReports, sortByWorkspace.reports]);

  const filteredReviewableSanctions = useMemo(() => {
    const items = reviewableSanctions.filter((sanction) => {
      if (!isWithinDateRange(sanction.startedAt, dateFromFilter, dateToFilter)) {
        return false;
      }

      if (sanctionSourceFilter === 'automatic') {
        return sanction.isAutomatic;
      }

      if (sanctionSourceFilter === 'manual') {
        return !sanction.isAutomatic;
      }

      return true;
    });

    return [...items].sort((left, right) => {
      switch (sortByWorkspace.sanctions) {
        case 'oldest':
          return compareAscendingDates(left.startedAt, right.startedAt);
        case 'expires-soon':
          return compareAscendingDates(left.endsAt, right.endsAt);
        case 'automatic-first': {
          const automaticDifference = Number(right.isAutomatic) - Number(left.isAutomatic);
          return automaticDifference || compareDescendingDates(left.startedAt, right.startedAt);
        }
        case 'newest':
        default:
          return compareDescendingDates(left.startedAt, right.startedAt);
      }
    });
  }, [dateFromFilter, dateToFilter, reviewableSanctions, sanctionSourceFilter, sortByWorkspace.sanctions]);

  const filteredReviewableAppeals = useMemo(() => {
    const items = reviewableAppeals.filter((appeal) => {
      if (!isWithinDateRange(appeal.createdAt, dateFromFilter, dateToFilter)) {
        return false;
      }

      if (appealStatusFilter) {
        return appeal.status === appealStatusFilter;
      }

      return true;
    });

    return [...items].sort((left, right) => {
      switch (sortByWorkspace.appeals) {
        case 'oldest':
          return compareAscendingDates(left.createdAt, right.createdAt);
        case 'pending-first': {
          const pendingDifference =
            Number(right.status === OperationalSanctionAppealStatus.Pending) -
            Number(left.status === OperationalSanctionAppealStatus.Pending);

          return pendingDifference || compareDescendingDates(left.createdAt, right.createdAt);
        }
        case 'newest':
        default:
          return compareDescendingDates(left.createdAt, right.createdAt);
      }
    });
  }, [appealStatusFilter, dateFromFilter, dateToFilter, reviewableAppeals, sortByWorkspace.appeals]);

  const sanctionsWithPendingAppeals = useMemo(
    () =>
      new Set(
        filteredReviewableAppeals
          .filter((appeal) => appeal.status === OperationalSanctionAppealStatus.Pending)
          .map((appeal) => appeal.sanctionId),
      ),
    [filteredReviewableAppeals],
  );

  const pendingDriverApplicationsCount = filteredDriverApplications.filter(
    (application) =>
      application.driverVerificationStatus === DriverVerificationStatus.PendingVerification,
  ).length;
  const openReportsCount = orderedReviewableReports.filter(
    (report) => report.status === ReportStatus.Pending || report.status === ReportStatus.UnderReview,
  ).length;
  const pendingAppealsCount = filteredReviewableAppeals.filter(
    (appeal) => appeal.status === OperationalSanctionAppealStatus.Pending,
  ).length;

  const driverStats = [
    { label: 'Pendientes', value: pendingDriverApplicationsCount },
    { label: 'Aprobadas', value: filteredDriverApplications.filter((item) => item.driverVerificationStatus === DriverVerificationStatus.Approved).length },
    { label: 'Rechazadas', value: filteredDriverApplications.filter((item) => item.driverVerificationStatus === DriverVerificationStatus.Rejected).length },
  ];

  const reportStats = [
    { label: 'Abiertos', value: openReportsCount },
    { label: 'Alta severidad', value: orderedReviewableReports.filter((item) => requiresDetailedReviewNote(item.reason) && (item.status === ReportStatus.Pending || item.status === ReportStatus.UnderReview)).length },
    { label: 'Resueltos', value: orderedReviewableReports.filter((item) => item.status === ReportStatus.Resolved).length },
  ];

  const sanctionStats = [
    { label: 'Activas', value: filteredReviewableSanctions.length },
    { label: 'Apeladas', value: sanctionsWithPendingAppeals.size },
    { label: 'Manuales', value: filteredReviewableSanctions.filter((item) => !item.isAutomatic).length },
  ];

  const appealStats = [
    { label: 'Pendientes', value: pendingAppealsCount },
    { label: 'Aprobadas', value: filteredReviewableAppeals.filter((item) => item.status === OperationalSanctionAppealStatus.Approved).length },
    { label: 'Rechazadas', value: filteredReviewableAppeals.filter((item) => item.status === OperationalSanctionAppealStatus.Rejected).length },
  ];

  const driverPageCount = Math.max(1, Math.ceil(filteredDriverApplications.length / PAGE_SIZES.driver));
  const reportPageCount = Math.max(1, Math.ceil(orderedReviewableReports.length / PAGE_SIZES.reports));
  const sanctionPageCount = Math.max(1, Math.ceil(filteredReviewableSanctions.length / PAGE_SIZES.sanctions));
  const appealPageCount = Math.max(1, Math.ceil(filteredReviewableAppeals.length / PAGE_SIZES.appeals));

  const driverPage = Math.min(pageByWorkspace.driver, driverPageCount);
  const reportPage = Math.min(pageByWorkspace.reports, reportPageCount);
  const sanctionPage = Math.min(pageByWorkspace.sanctions, sanctionPageCount);
  const appealPage = Math.min(pageByWorkspace.appeals, appealPageCount);

  const paginatedDriverApplications = filteredDriverApplications.slice(
    (driverPage - 1) * PAGE_SIZES.driver,
    driverPage * PAGE_SIZES.driver,
  );
  const paginatedReports = orderedReviewableReports.slice(
    (reportPage - 1) * PAGE_SIZES.reports,
    reportPage * PAGE_SIZES.reports,
  );
  const paginatedSanctions = filteredReviewableSanctions.slice(
    (sanctionPage - 1) * PAGE_SIZES.sanctions,
    sanctionPage * PAGE_SIZES.sanctions,
  );
  const paginatedAppeals = filteredReviewableAppeals.slice(
    (appealPage - 1) * PAGE_SIZES.appeals,
    appealPage * PAGE_SIZES.appeals,
  );

  if (isLoading) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.loadingShell}>
          <article className={styles.stateCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.stateTitle}>Cargando moderacion</h1>
            <p className={styles.stateText}>Preparando las bandejas administrativas.</p>
          </article>
        </section>
      </>
    );
  }

  if (!canAccessAdminView) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.page}>
          <header className={styles.dashboardHeader}>
            <h1 className={styles.headerTitle}>Moderación (Acceso Restringido)</h1>
            <Button variant="ghost" onClick={() => router.push('/')}>Volver al Inicio</Button>
          </header>
        </section>
      </>
    );
  }

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <section className={styles.page}>
        <header className={styles.dashboardHeader}>
          <h1 className={styles.headerTitle}>Centro de Moderación</h1>
          <Button
            disabled={isRefreshingData}
            onClick={() => void refreshData(true)}
            variant="secondary"
          >
            <span className={styles.buttonIcon}>
              <InlineIcon className={styles.icon} name="refresh" />
            </span>
            {isRefreshingData ? 'Actualizando...' : 'Actualizar Datos'}
          </Button>
        </header>

        <div className={styles.dashboardTabs}>
          <button
            aria-pressed={activeWorkspace === 'driver'}
            className={[styles.dashboardTab, activeWorkspace === 'driver' ? styles.dashboardTabActive : ''].filter(Boolean).join(' ')}
            onClick={() => openWorkspace('driver')}
          >
            Conductores
            {pendingDriverApplicationsCount > 0 && <span className={styles.tabBadge}>{pendingDriverApplicationsCount}</span>}
          </button>
          <button
            aria-pressed={activeWorkspace === 'reports'}
            className={[styles.dashboardTab, activeWorkspace === 'reports' ? styles.dashboardTabActive : ''].filter(Boolean).join(' ')}
            onClick={() => openWorkspace('reports')}
          >
            Reportes
            {openReportsCount > 0 && <span className={styles.tabBadge}>{openReportsCount}</span>}
          </button>
          <button
            aria-pressed={activeWorkspace === 'sanctions'}
            className={[styles.dashboardTab, activeWorkspace === 'sanctions' ? styles.dashboardTabActive : ''].filter(Boolean).join(' ')}
            onClick={() => openWorkspace('sanctions')}
          >
            Sanciones
            {reviewableSanctions.length > 0 && <span className={styles.tabBadge}>{reviewableSanctions.length}</span>}
          </button>
          <button
            aria-pressed={activeWorkspace === 'appeals'}
            className={[styles.dashboardTab, activeWorkspace === 'appeals' ? styles.dashboardTabActive : ''].filter(Boolean).join(' ')}
            onClick={() => openWorkspace('appeals')}
          >
            Apelaciones
            {pendingAppealsCount > 0 && <span className={styles.tabBadge}>{pendingAppealsCount}</span>}
          </button>
        </div>

        <div className={styles.filtersBar}>
          <SelectField
            label="Institución"
            onChange={(event) => setInstitutionId(event.target.value)}
            value={institutionId}
          >
            <option value="">Todas las instituciones</option>
            {institutionOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Orden"
            onChange={(event) =>
              setSortByWorkspace((current) => ({
                ...current,
                [activeWorkspace]: event.target.value as ModerationSortOption,
              }))
            }
            value={sortByWorkspace[activeWorkspace]}
          >
            {activeWorkspace === 'driver' ? (
              <>
                <option value="newest">Mas recientes primero</option>
                <option value="oldest">Mas antiguas primero</option>
                <option value="license-expiring">Licencia mas proxima a vencer</option>
                <option value="name-asc">Nombre del solicitante</option>
              </>
            ) : null}

            {activeWorkspace === 'reports' ? (
              <>
                <option value="priority-recent">Prioridad y recientes</option>
                <option value="newest">Mas recientes primero</option>
                <option value="oldest">Mas antiguos primero</option>
                <option value="severity-first">Alta severidad primero</option>
              </>
            ) : null}

            {activeWorkspace === 'sanctions' ? (
              <>
                <option value="newest">Mas recientes primero</option>
                <option value="oldest">Mas antiguas primero</option>
                <option value="expires-soon">Proximas a vencer primero</option>
                <option value="automatic-first">Automaticas primero</option>
              </>
            ) : null}

            {activeWorkspace === 'appeals' ? (
              <>
                <option value="newest">Mas recientes primero</option>
                <option value="oldest">Mas antiguas primero</option>
                <option value="pending-first">Pendientes primero</option>
              </>
            ) : null}
          </SelectField>

          <InputField
            label="Desde"
            onChange={(event) => setDateFromFilter(event.target.value)}
            type="date"
            value={dateFromFilter}
          />

          <InputField
            label="Hasta"
            onChange={(event) => setDateToFilter(event.target.value)}
            type="date"
            value={dateToFilter}
          />

          {activeWorkspace === 'driver' && (
            <SelectField
              label="Estado de solicitud"
              onChange={(event) => setDriverApplicationStatusFilter(event.target.value)}
              value={driverApplicationStatusFilter}
            >
              <option value="">Todos los estados</option>
              <option value={DriverVerificationStatus.PendingVerification}>Pendientes</option>
              <option value={DriverVerificationStatus.Approved}>Aprobadas</option>
              <option value={DriverVerificationStatus.Rejected}>Rechazadas</option>
              <option value={DriverVerificationStatus.Suspended}>Suspendidas</option>
            </SelectField>
          )}

          {activeWorkspace === 'reports' && (
            <>
              <SelectField
                label="Estado del reporte"
                onChange={(event) => setReportStatusFilter(event.target.value)}
                value={reportStatusFilter}
              >
                <option value="">Todos los estados</option>
                <option value={ReportStatus.Pending}>Pendientes</option>
                <option value={ReportStatus.UnderReview}>En revisión</option>
                <option value={ReportStatus.Resolved}>Resueltos</option>
                <option value={ReportStatus.Dismissed}>Desestimados</option>
              </SelectField>

              <SelectField
                label="Severidad"
                onChange={(event) => setReportSeverityFilter(event.target.value)}
                value={reportSeverityFilter}
              >
                <option value="">Todas</option>
                <option value="high">Alta severidad</option>
                <option value="regular">Regular</option>
              </SelectField>
            </>
          )}

          {activeWorkspace === 'sanctions' && (
            <SelectField
              label="Origen de sancion"
              onChange={(event) => setSanctionSourceFilter(event.target.value)}
              value={sanctionSourceFilter}
            >
              <option value="">Todas</option>
              <option value="automatic">Automaticas</option>
              <option value="manual">Manuales</option>
            </SelectField>
          )}

          {activeWorkspace === 'appeals' && (
            <SelectField
              label="Estado de apelacion"
              onChange={(event) => setAppealStatusFilter(event.target.value)}
              value={appealStatusFilter}
            >
              <option value="">Todas</option>
              <option value={OperationalSanctionAppealStatus.Pending}>Pendientes</option>
              <option value={OperationalSanctionAppealStatus.Approved}>Aprobadas</option>
              <option value={OperationalSanctionAppealStatus.Rejected}>Rechazadas</option>
            </SelectField>
          )}

          <div className={styles.filterActions}>
            <Button onClick={() => void refreshData(true)}>Actualizar datos</Button>
            {activeFiltersCount > 0 && (
              <Button onClick={handleResetFilters} variant="ghost">Limpiar</Button>
            )}
          </div>
        </div>

        <div className={styles.statsRow}>
          {(activeWorkspace === 'driver' ? driverStats :
            activeWorkspace === 'reports' ? reportStats :
            activeWorkspace === 'sanctions' ? sanctionStats :
            appealStats).map((stat) => (
            <StatChip key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            {activeWorkspace === 'driver' && (
              <>
                <thead>
                  <tr>
                    <th>Solicitante</th>
                    <th>Institución</th>
                    <th>Estado de Solicitud</th>
                    <th>Licencia</th>
                    <th>Fecha Envío</th>
                    <th className={styles.actionsCell}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDriverApplications.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className={styles.emptyState}>
                          <h3 className={styles.emptyTitle}>Sin solicitudes</h3>
                          <p>No se encontraron solicitudes con los filtros actuales.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedDriverApplications.map((application) => (
                      <tr key={application.membershipId} className={highlightedMembershipId === application.membershipId ? styles.rowHighlight : ''}>
                        <td>
                          <span className={styles.tdPrimary}>{application.userFullName}</span>
                          <span className={styles.tdSecondary}>{application.userEmail}</span>
                        </td>
                        <td>{application.institutionName}</td>
                        <td>
                          <StatusPill label={getDriverStatusLabel(application.driverVerificationStatus)} tone={getDriverStatusTone(application.driverVerificationStatus)} />
                        </td>
                        <td>
                          <span className={styles.tdPrimary}>{application.licenseType.code} - {application.licenseType.name}</span>
                          <span className={styles.tdSecondary}>Expira: {formatDateTime(application.licenseExpiresAt)}</span>
                        </td>
                        <td>{formatDateTime(application.submittedAt)}</td>
                        <td className={styles.actionsCell}>
                          <Button onClick={() => setActiveDriverApplication(application)} variant="secondary">
                            Revisar
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            )}

            {activeWorkspace === 'reports' && (
              <>
                <thead>
                  <tr>
                    <th>Reportado</th>
                    <th>Reportante</th>
                    <th>Motivo</th>
                    <th>Estado / Severidad</th>
                    <th>Antigüedad</th>
                    <th className={styles.actionsCell}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReports.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className={styles.emptyState}>
                          <h3 className={styles.emptyTitle}>Sin reportes</h3>
                          <p>No se encontraron reportes con los filtros actuales.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedReports.map((report) => (
                      <tr key={report.id} className={highlightedReportId === report.id ? styles.rowHighlight : ''}>
                        <td>
                          <span className={styles.tdPrimary}>{report.reportedFullName}</span>
                        </td>
                        <td>
                          <span className={styles.tdPrimary}>{report.reporterFullName}</span>
                          <span className={styles.tdSecondary}>{report.institutionName}</span>
                        </td>
                        <td>{getReportReasonLabel(report.reason)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <StatusPill label={getReportStatusLabel(report.status)} tone={getReportStatusTone(report.status)} />
                            <StatusPill label={getReportSeverityLabel(report.reason)} tone={getReportSeverityTone(report.reason)} />
                          </div>
                        </td>
                        <td>
                           <span className={styles.tdPrimary}>{formatRelativeElapsed(report.createdAt)}</span>
                           <span className={styles.tdSecondary}>{formatDateTime(report.createdAt)}</span>
                        </td>
                        <td className={styles.actionsCell}>
                          <Button onClick={() => setActiveReport(report)} variant="secondary">
                            Revisar
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            )}

            {activeWorkspace === 'sanctions' && (
              <>
                <thead>
                  <tr>
                    <th>Usuario Sancionado</th>
                    <th>Institución</th>
                    <th>Sanción</th>
                    <th>Disparador</th>
                    <th>Vigencia</th>
                    <th className={styles.actionsCell}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSanctions.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className={styles.emptyState}>
                          <h3 className={styles.emptyTitle}>Sin sanciones</h3>
                          <p>No se encontraron sanciones con los filtros actuales.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedSanctions.map((sanction) => (
                      <tr key={sanction.id} className={highlightedSanctionId === sanction.id ? styles.rowHighlight : ''}>
                        <td>
                          <span className={styles.tdPrimary}>{sanction.membershipUserFullName}</span>
                        </td>
                        <td>{sanction.institutionName}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <StatusPill label={getOperationalSanctionTypeLabel(sanction.type)} tone={getOperationalSanctionTone(sanction.type)} />
                            <StatusPill label={getOperationalSanctionScopeLabel(sanction.scope)} tone="neutral" />
                          </div>
                        </td>
                        <td>{getOperationalSanctionTriggerLabel(sanction.trigger)}</td>
                        <td>
                          <span className={styles.tdPrimary}>{sanction.endsAt ? formatDateTime(sanction.endsAt) : 'Indefinida'}</span>
                        </td>
                        <td className={styles.actionsCell}>
                          <Button onClick={() => setActiveSanction(sanction)} variant="secondary">
                            Detalle
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            )}

            {activeWorkspace === 'appeals' && (
              <>
                <thead>
                  <tr>
                    <th>Usuario Afectado</th>
                    <th>Solicitante</th>
                    <th>Estado / Sanción</th>
                    <th>Disparador Sanción</th>
                    <th>Fecha de Apelación</th>
                    <th className={styles.actionsCell}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAppeals.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className={styles.emptyState}>
                          <h3 className={styles.emptyTitle}>Sin apelaciones</h3>
                          <p>No se encontraron apelaciones con los filtros actuales.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedAppeals.map((appeal) => (
                      <tr key={appeal.id}>
                        <td>
                          <span className={styles.tdPrimary}>{appeal.affectedFullName}</span>
                        </td>
                        <td>
                          <span className={styles.tdPrimary}>{appeal.requestedByFullName}</span>
                          <span className={styles.tdSecondary}>{appeal.institutionName}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <StatusPill label={getSanctionAppealStatusLabel(appeal.status)} tone={getSanctionAppealStatusTone(appeal.status)} />
                            <StatusPill label={getOperationalSanctionTypeLabel(appeal.sanctionType)} tone={getOperationalSanctionTone(appeal.sanctionType)} />
                          </div>
                        </td>
                        <td>{getOperationalSanctionTriggerLabel(appeal.sanctionTrigger)}</td>
                        <td>{formatDateTime(appeal.createdAt)}</td>
                        <td className={styles.actionsCell}>
                          <Button onClick={() => setActiveAppeal(appeal)} variant="secondary">
                            Revisar
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            )}
          </table>

          {((activeWorkspace === 'driver' && driverPageCount > 1) ||
            (activeWorkspace === 'reports' && reportPageCount > 1) ||
            (activeWorkspace === 'sanctions' && sanctionPageCount > 1) ||
            (activeWorkspace === 'appeals' && appealPageCount > 1)) && (
            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                Página {
                  activeWorkspace === 'driver' ? driverPage :
                  activeWorkspace === 'reports' ? reportPage :
                  activeWorkspace === 'sanctions' ? sanctionPage : appealPage
                } de {
                  activeWorkspace === 'driver' ? driverPageCount :
                  activeWorkspace === 'reports' ? reportPageCount :
                  activeWorkspace === 'sanctions' ? sanctionPageCount : appealPageCount
                }
              </span>
              <div className={styles.paginationActions}>
                <Button 
                  onClick={() => setPageByWorkspace(curr => ({ ...curr, [activeWorkspace]: Math.max(1, curr[activeWorkspace] - 1)}))}
                  variant="ghost"
                  disabled={(activeWorkspace === 'driver' ? driverPage : activeWorkspace === 'reports' ? reportPage : activeWorkspace === 'sanctions' ? sanctionPage : appealPage) <= 1}
                >
                  Anterior
                </Button>
                <Button 
                  onClick={() => setPageByWorkspace(curr => ({ ...curr, [activeWorkspace]: Math.min(
                    activeWorkspace === 'driver' ? driverPageCount : activeWorkspace === 'reports' ? reportPageCount : activeWorkspace === 'sanctions' ? sanctionPageCount : appealPageCount,
                    curr[activeWorkspace] + 1
                  )}))}
                  variant="ghost"
                  disabled={(activeWorkspace === 'driver' ? driverPage : activeWorkspace === 'reports' ? reportPage : activeWorkspace === 'sanctions' ? sanctionPage : appealPage) >= (activeWorkspace === 'driver' ? driverPageCount : activeWorkspace === 'reports' ? reportPageCount : activeWorkspace === 'sanctions' ? sanctionPageCount : appealPageCount)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <ModerationModals
        activeAppeal={activeAppeal}
        activeDriverApplication={activeDriverApplication}
        activeReport={activeReport}
        activeSanction={activeSanction}
        appealReviewNotes={appealReviewNotes}
        driverDocumentPreview={driverDocumentPreview}
        driverDocumentPreviewError={driverDocumentPreviewError}
        driverReviewNotes={driverReviewNotes}
        formatDateTime={formatDateTime}
        formatRelativeElapsed={formatRelativeElapsed}
        getDriverPreviewUserName={(membershipId) =>
          reviewableDriverApplications.find((application) => application.membershipId === membershipId)?.userFullName ?? 'usuario'
        }
        getOperationalSanctionTriggerLabel={(value) =>
          getOperationalSanctionTriggerLabel(value as OperationalSanctionTrigger)
        }
        getReportPreviewRecord={(reportId) => reviewableReports.find((item) => item.id === reportId)}
        isDownloadingDriverDocumentKey={isDownloadingDriverDocumentKey}
        isDownloadingReportEvidenceId={isDownloadingReportEvidenceId}
        isLiftingSanctionId={isLiftingSanctionId}
        isOpeningDriverDocumentKey={isOpeningDriverDocumentKey}
        isOpeningReportEvidenceId={isOpeningReportEvidenceId}
        isReviewingAppealId={isReviewingAppealId}
        isReviewingDriverMembershipId={isReviewingDriverMembershipId}
        isReviewingReportId={isReviewingReportId}
        onAppealReviewNoteChange={handleAppealReviewNoteChange}
        onCloseAppeal={() => setActiveAppeal(null)}
        onCloseDriverApplication={() => setActiveDriverApplication(null)}
        onCloseReport={() => setActiveReport(null)}
        onCloseSanction={() => setActiveSanction(null)}
        onDownloadDriverDocument={handleDownloadDriverDocument}
        onDownloadReportEvidence={handleDownloadReportEvidence}
        onDriverReviewNoteChange={handleDriverReviewNoteChange}
        onLiftSanction={handleLiftSanction}
        onOpenDriverDocumentPreview={handleOpenDriverDocumentPreview}
        onOpenReportEvidencePreview={handleOpenReportEvidencePreview}
        onReviewAppeal={handleReviewAppeal}
        onReviewDriverApplication={handleReviewDriverApplication}
        onReviewNoteChange={handleReviewNoteChange}
        onReviewReport={handleReviewReport}
        onSanctionLiftNoteChange={handleSanctionLiftNoteChange}
        reportEvidencePreview={reportEvidencePreview}
        reportEvidencePreviewError={reportEvidencePreviewError}
        resetDriverDocumentPreview={resetDriverDocumentPreview}
        resetReportEvidencePreview={resetReportEvidencePreview}
        reviewNotes={reviewNotes}
        sanctionLiftNotes={sanctionLiftNotes}
      />
    </>
  );
}
