import { ReportStatus } from '@saferidepro/shared-types';

import { apiRequest } from '../../../lib/api-client';
import type {
  CreateReportInput,
  ReportRecord,
  ReviewReportInput,
} from '../types/report';

type ReportListResponse = {
  items: ReportRecord[];
};

type ReportMutationResponse = {
  message: string;
  report: ReportRecord;
};

type ReportInboxFilters = {
  institutionId?: string;
  status?: ReportStatus;
  limit?: number;
};

export async function listMyReports(accessToken: string): Promise<ReportRecord[]> {
  const response = await apiRequest<ReportListResponse>('/reports/me', {
    accessToken,
  });

  return response.items;
}

export async function listReviewableReports(
  accessToken: string,
  filters: ReportInboxFilters = {},
): Promise<ReportRecord[]> {
  const response = await apiRequest<ReportListResponse>('/reports/inbox', {
    accessToken,
    searchParams: {
      institutionId: filters.institutionId,
      status: filters.status,
      limit: filters.limit ? String(filters.limit) : undefined,
    },
  });

  return response.items;
}

export async function createReport(
  accessToken: string,
  input: CreateReportInput,
): Promise<ReportMutationResponse> {
  return apiRequest<ReportMutationResponse>('/reports', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function reviewReport(
  accessToken: string,
  reportId: string,
  input: ReviewReportInput,
): Promise<ReportMutationResponse> {
  return apiRequest<ReportMutationResponse>(`/reports/${reportId}/review`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}
