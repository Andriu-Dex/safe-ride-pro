import type {
  DriverOverview,
  LicenseTypeCatalogItem,
  SubmitDriverApplicationInput,
} from '../types/driver';
import { apiRequest } from '../../../lib/api-client';

type SubmitDriverApplicationResponse = {
  message: string;
  driverProfile: DriverOverview['driverProfile'];
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

