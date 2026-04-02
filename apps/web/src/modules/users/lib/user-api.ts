import { apiRequest } from '../../../lib/api-client';
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
