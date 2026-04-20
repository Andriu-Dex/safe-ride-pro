import { ReportStatus } from '@saferidepro/shared-types';

import { API_BASE_URL, ApiError, apiRequest } from '../../../lib/api-client';
import type {
  CreateReportInput,
  ReportEvidenceUploadResponse,
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

export async function uploadReportEvidence(
  accessToken: string,
  file: File,
): Promise<ReportEvidenceUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/reports/me/evidence`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
    cache: 'no-store',
  });

  const responseData =
    (await response.json().catch(() => null)) as ReportEvidenceUploadResponse | {
      message?: string | string[];
      error?: string;
    } | null;

  if (!response.ok) {
    const errorPayload = responseData as
      | { message?: string | string[]; error?: string }
      | null;
    const message = Array.isArray(errorPayload?.message)
      ? errorPayload?.message[0]
      : errorPayload?.message ?? errorPayload?.error ?? 'No fue posible cargar la evidencia.';
    throw new ApiError(message, response.status);
  }

  return responseData as ReportEvidenceUploadResponse;
}

export async function downloadReportEvidence(
  accessToken: string,
  reportId: string,
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/reports/${reportId}/evidence`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string | string[]; error?: string }
      | null;
    const message = Array.isArray(payload?.message)
      ? payload?.message[0]
      : payload?.message ?? payload?.error ?? 'No fue posible descargar la evidencia.';
    throw new ApiError(message, response.status);
  }

  return response.blob();
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
