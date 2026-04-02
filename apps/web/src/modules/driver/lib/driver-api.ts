import type {
  DriverDocumentType,
  DriverDocumentUploadResponse,
  DriverOverview,
  LicenseTypeCatalogItem,
  ReviewDriverApplicationInput,
  ReviewableDriverApplicationRecord,
  SubmitDriverApplicationInput,
} from '../types/driver';
import { API_BASE_URL, ApiError, apiRequest } from '../../../lib/api-client';

type SubmitDriverApplicationResponse = {
  message: string;
  driverProfile: DriverOverview['driverProfile'];
};

type DriverApplicationListResponse = {
  items: ReviewableDriverApplicationRecord[];
};

export async function getDriverOverview(accessToken: string): Promise<DriverOverview> {
  return apiRequest<DriverOverview>('/drivers/me', {
    accessToken,
  });
}

export async function listDriverLicenseTypes(accessToken: string): Promise<LicenseTypeCatalogItem[]> {
  return apiRequest<LicenseTypeCatalogItem[]>('/vehicles/catalogs/license-types', {
    accessToken,
  });
}

export async function submitDriverApplication(
  accessToken: string,
  input: SubmitDriverApplicationInput,
): Promise<SubmitDriverApplicationResponse> {
  return apiRequest<SubmitDriverApplicationResponse>('/drivers/application', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function uploadDriverDocument(
  accessToken: string,
  documentType: DriverDocumentType,
  file: File,
): Promise<DriverDocumentUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/drivers/me/documents/${documentType}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
    cache: 'no-store',
  });

  const responseData =
    (await response.json().catch(() => null)) as DriverDocumentUploadResponse | {
      message?: string | string[];
      error?: string;
    } | null;

  if (!response.ok) {
    const errorPayload = responseData as
      | { message?: string | string[]; error?: string }
      | null;
    const message = Array.isArray(errorPayload?.message)
      ? errorPayload?.message[0]
      : errorPayload?.message ?? errorPayload?.error ?? 'No fue posible cargar el documento.';
    throw new ApiError(message, response.status);
  }

  return responseData as DriverDocumentUploadResponse;
}

export async function listReviewableDriverApplications(
  accessToken: string,
  filters: {
    institutionId?: string;
    status?: string;
    limit?: number;
  } = {},
): Promise<ReviewableDriverApplicationRecord[]> {
  const response = await apiRequest<DriverApplicationListResponse>('/drivers/applications/inbox', {
    accessToken,
    searchParams: {
      institutionId: filters.institutionId,
      status: filters.status,
      limit: filters.limit ? String(filters.limit) : undefined,
    },
  });

  return response.items;
}

export async function reviewDriverApplication(
  accessToken: string,
  membershipId: string,
  input: ReviewDriverApplicationInput,
): Promise<SubmitDriverApplicationResponse> {
  return apiRequest<SubmitDriverApplicationResponse>(
    `/drivers/applications/${membershipId}/review`,
    {
      method: 'PATCH',
      accessToken,
      body: input,
    },
  );
}

export async function downloadDriverApplicationDocument(
  accessToken: string,
  membershipId: string,
  documentType: DriverDocumentType,
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/drivers/applications/${membershipId}/documents/${documentType}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string | string[]; error?: string }
      | null;
    const message = Array.isArray(payload?.message)
      ? payload?.message[0]
      : payload?.message ?? payload?.error ?? 'No fue posible descargar el documento.';
    throw new ApiError(message, response.status);
  }

  return response.blob();
}

