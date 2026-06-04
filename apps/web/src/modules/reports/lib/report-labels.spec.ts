import { ReportStatus } from '@saferidepro/shared-types';
import { describe, expect, it } from 'vitest';

import {
  getReportReasonLabel,
  getReportSeverityLabel,
  getReportSeverityTone,
  getReportStatusLabel,
  getReportStatusTone,
  requiresDetailedReviewNote,
} from './report-labels';

describe('report-labels', () => {
  it('maps report status labels and tones', () => {
    expect(getReportStatusLabel(ReportStatus.Pending)).toBe('Pendiente de revision');
    expect(getReportStatusLabel(ReportStatus.UnderReview)).toBe('En revision');
    expect(getReportStatusLabel(ReportStatus.Resolved)).toBe('Resuelto');
    expect(getReportStatusLabel(ReportStatus.Dismissed)).toBe('Desestimado');

    expect(getReportStatusTone(ReportStatus.Pending)).toBe('warning');
    expect(getReportStatusTone(ReportStatus.UnderReview)).toBe('neutral');
    expect(getReportStatusTone(ReportStatus.Resolved)).toBe('success');
    expect(getReportStatusTone(ReportStatus.Dismissed)).toBe('danger');
  });

  it('maps report reasons and severity helpers', () => {
    expect(getReportReasonLabel('UNSAFE_DRIVING')).toBe('Conduccion insegura');
    expect(getReportReasonLabel('CUSTOM_REASON')).toBe('Custom reason');

    expect(getReportSeverityLabel('UNSAFE_DRIVING')).toBe('Alta severidad');
    expect(getReportSeverityTone('UNSAFE_DRIVING')).toBe('danger');
    expect(requiresDetailedReviewNote('UNSAFE_DRIVING')).toBe(true);

    expect(getReportSeverityTone('ROUTE_ISSUE')).toBe('neutral');
    expect(requiresDetailedReviewNote('ROUTE_ISSUE')).toBe(false);
  });
});
