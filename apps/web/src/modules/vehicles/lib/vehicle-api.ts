import { VehicleType } from '@saferidepro/shared-types';

import { API_BASE_URL, ApiError, apiRequest } from '../../../lib/api-client';
import type {
  RegisterVehicleInput,
  UpdateVehicleInput,
  VehicleBrandCatalogItem,
  VehicleDocumentUploadResponse,
  VehicleModelCatalogItem,
  VehicleOverview,
  VehicleRecord,
} from '../types/vehicle';

type RegisterVehicleResponse = {
  message: string;
  vehicle: VehicleRecord;
};

export async function getVehicleOverview(accessToken: string): Promise<VehicleOverview> {
  return apiRequest<VehicleOverview>('/vehicles/me', {
    accessToken,
  });
}

export async function listVehicleBrands(
  accessToken: string,
  vehicleType?: VehicleType,
): Promise<VehicleBrandCatalogItem[]> {
  return apiRequest<VehicleBrandCatalogItem[]>('/vehicles/catalogs/brands', {
    accessToken,
    searchParams: {
      vehicleType,
    },
  });
}

export async function listVehicleModels(
  accessToken: string,
  filters: { brandId?: string; vehicleType?: VehicleType },
): Promise<VehicleModelCatalogItem[]> {
  return apiRequest<VehicleModelCatalogItem[]>('/vehicles/catalogs/models', {
    accessToken,
    searchParams: {
      brandId: filters.brandId,
      vehicleType: filters.vehicleType,
    },
  });
}

export async function registerVehicle(
  accessToken: string,
  input: RegisterVehicleInput,
): Promise<RegisterVehicleResponse> {
  return apiRequest<RegisterVehicleResponse>('/vehicles', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateVehicle(
  accessToken: string,
  vehicleId: string,
  input: UpdateVehicleInput,
): Promise<RegisterVehicleResponse> {
  return apiRequest<RegisterVehicleResponse>(`/vehicles/${vehicleId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function setVehicleActiveStatus(
  accessToken: string,
  vehicleId: string,
  isActive: boolean,
): Promise<RegisterVehicleResponse> {
  return apiRequest<RegisterVehicleResponse>(`/vehicles/${vehicleId}/status`, {
    method: 'PATCH',
    accessToken,
    body: {
      isActive,
    },
  });
}

export async function uploadVehicleRegistrationDocument(
  accessToken: string,
  file: File,
): Promise<VehicleDocumentUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/vehicles/me/documents/registration`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
    cache: 'no-store',
  });

  const responseData =
    (await response.json().catch(() => null)) as VehicleDocumentUploadResponse | {
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

  return responseData as VehicleDocumentUploadResponse;
}

export async function downloadVehicleRegistrationDocument(
  accessToken: string,
  vehicleId: string,
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/vehicles/${vehicleId}/documents/registration`,
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

