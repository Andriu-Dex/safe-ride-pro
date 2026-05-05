import { apiRequest } from '../../../lib/api-client';
import type {
  InstitutionSettingsResponse,
  UpdateInstitutionSettingsInput,
} from '../types/institution-settings';

type SettingsMutationResponse = InstitutionSettingsResponse & {
  message: string;
};

export async function getInstitutionSettings(
  accessToken: string,
  institutionId?: string,
): Promise<InstitutionSettingsResponse> {
  return apiRequest<InstitutionSettingsResponse>('/institutions/settings', {
    accessToken,
    searchParams: {
      institutionId,
    },
  });
}

export async function updateInstitutionSettings(
  accessToken: string,
  input: UpdateInstitutionSettingsInput,
  institutionId?: string,
): Promise<SettingsMutationResponse> {
  return apiRequest<SettingsMutationResponse>('/institutions/settings', {
    method: 'PATCH',
    accessToken,
    searchParams: {
      institutionId,
    },
    body: input,
  });
}
