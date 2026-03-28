import { VehicleType } from '@saferidepro/shared-types';

import { apiRequest } from '../../../lib/api-client';
import type {
  RegisterVehicleInput,
  VehicleBrandCatalogItem,
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

export async function listVehicleBrands(accessToken: string): Promise<VehicleBrandCatalogItem[]> {
  return apiRequest<VehicleBrandCatalogItem[]>('/vehicles/catalogs/brands', {
    accessToken,
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

