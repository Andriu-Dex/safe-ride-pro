import { apiRequest } from '../../../lib/api-client';
import type { TrustSummary } from '../types/trust-summary';

export async function getCurrentUserTrustSummary(accessToken: string): Promise<TrustSummary> {
  return apiRequest<TrustSummary>('/users/me/trust-summary', {
    accessToken,
  });
}
