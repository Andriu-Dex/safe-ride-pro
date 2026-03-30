export enum ReportSeverity {
  Low = 'LOW',
  Medium = 'MEDIUM',
  High = 'HIGH',
}

export const HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH = 20;

export function getReportSeverity(reason: string): ReportSeverity {
  switch (reason.trim().toUpperCase()) {
    case 'UNSAFE_DRIVING':
    case 'INAPPROPRIATE_BEHAVIOR':
      return ReportSeverity.High;
    case 'NO_SHOW':
    case 'OTHER':
      return ReportSeverity.Medium;
    case 'ROUTE_ISSUE':
      return ReportSeverity.Low;
    default:
      return ReportSeverity.Medium;
  }
}
