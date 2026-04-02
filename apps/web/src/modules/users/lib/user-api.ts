import { API_BASE_URL, apiRequest } from '../../../lib/api-client';
import type { AuthUser } from '../../auth/types/auth-session';
import type { TrustSummary } from '../types/trust-summary';

export type UpdateCurrentUserProfileInput = {
  fullName?: string;
  career?: string;
  phone?: string;
  referenceNeighborhood?: string;
  profilePhotoUrl?: string;
  acceptTerms?: boolean;
  acceptPrivacy?: boolean;
  acceptSafetyRules?: boolean;
};

export async function getCurrentUserTrustSummary(accessToken: string): Promise<TrustSummary> {
  return apiRequest<TrustSummary>('/users/me/trust-summary', {
    accessToken,
  });
}

export async function updateCurrentUserProfile(
  accessToken: string,
  input: UpdateCurrentUserProfileInput,
): Promise<AuthUser> {
  return apiRequest<AuthUser>('/users/me', {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function uploadCurrentUserProfilePhoto(
  accessToken: string,
  file: File,
): Promise<AuthUser> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${API_BASE_URL}/users/me/profile-photo`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
      cache: 'no-store',
    },
  );

  const responseData = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof responseData?.message === 'string'
        ? responseData.message
        : Array.isArray(responseData?.message)
          ? responseData.message[0]
          : 'No fue posible subir la imagen de perfil.';

    throw new Error(message);
  }

  return responseData as AuthUser;
}
