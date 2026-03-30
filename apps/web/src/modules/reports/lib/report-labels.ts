import {
  getReportSeverity,
  HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH,
  ReportSeverity,
  ReportStatus,
} from '@saferidepro/shared-types';

export const REPORT_REASON_OPTIONS = [
  { label: 'Conduccion insegura', value: 'UNSAFE_DRIVING' },
  { label: 'Comportamiento inapropiado', value: 'INAPPROPRIATE_BEHAVIOR' },
  { label: 'Incumplimiento o ausencia', value: 'NO_SHOW' },
  { label: 'Problema de ruta o parada', value: 'ROUTE_ISSUE' },
  { label: 'Otro motivo', value: 'OTHER' },
] as const;

export function getReportStatusLabel(status: ReportStatus): string {
  switch (status) {
    case ReportStatus.Pending:
      return 'Pendiente';
    case ReportStatus.UnderReview:
      return 'En revision';
    case ReportStatus.Resolved:
      return 'Resuelto';
    case ReportStatus.Dismissed:
      return 'Desestimado';
    default:
      return status;
  }
}

export function getReportStatusTone(status: ReportStatus): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case ReportStatus.Pending:
      return 'warning';
    case ReportStatus.UnderReview:
      return 'neutral';
    case ReportStatus.Resolved:
      return 'success';
    case ReportStatus.Dismissed:
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getReportReasonLabel(reason: string): string {
  const option = REPORT_REASON_OPTIONS.find((entry) => entry.value === reason);

  if (option) {
    return option.label;
  }

  return reason
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (character) => character.toUpperCase());
}

export function getReportSeverityLabel(reason: string): string {
  switch (getReportSeverity(reason)) {
    case ReportSeverity.High:
      return 'Alta severidad';
    case ReportSeverity.Medium:
      return 'Severidad media';
    case ReportSeverity.Low:
      return 'Severidad baja';
    default:
      return 'Severidad media';
  }
}

export function getReportSeverityTone(
  reason: string,
): 'neutral' | 'warning' | 'danger' | 'success' {
  switch (getReportSeverity(reason)) {
    case ReportSeverity.High:
      return 'danger';
    case ReportSeverity.Medium:
      return 'warning';
    case ReportSeverity.Low:
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function requiresDetailedReviewNote(reason: string): boolean {
  return getReportSeverity(reason) === ReportSeverity.High;
}

export { HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH };
