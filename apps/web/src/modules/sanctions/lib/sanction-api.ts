import type { OperationalSanctionAppealStatus } from '@saferidepro/shared-types';

import { apiRequest } from '../../../lib/api-client';
import type {
  LiftOperationalSanctionInput,
  OperationalSanctionAppealRecord,
  ReviewableOperationalSanctionRecord,
  ReviewSanctionAppealInput,
  SubmitSanctionAppealInput,
} from '../types/sanction';

type SanctionAppealListResponse = {
  items: OperationalSanctionAppealRecord[];
};

type ReviewableSanctionListResponse = {
  items: ReviewableOperationalSanctionRecord[];
};

type SanctionAppealMutationResponse = {
  message: string;
  appeal: OperationalSanctionAppealRecord;
};

type SanctionLiftMutationResponse = {
  message: string;
  sanction: ReviewableOperationalSanctionRecord;
};

type ReviewableAppealFilters = {
  institutionId?: string;
  status?: OperationalSanctionAppealStatus;
  limit?: number;
};

type ReviewableSanctionFilters = {
  institutionId?: string;
  userId?: string;
  limit?: number;
};

export async function listMySanctionAppeals(
  accessToken: string,
): Promise<OperationalSanctionAppealRecord[]> {
  const response = await apiRequest<SanctionAppealListResponse>('/sanctions/appeals/me', {
    accessToken,
  });

  return response.items;
}

export async function submitSanctionAppeal(
  accessToken: string,
  sanctionId: string,
  input: SubmitSanctionAppealInput,
): Promise<SanctionAppealMutationResponse> {
  return apiRequest<SanctionAppealMutationResponse>(`/sanctions/${sanctionId}/appeals`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function listReviewableSanctionAppeals(
  accessToken: string,
  filters: ReviewableAppealFilters = {},
): Promise<OperationalSanctionAppealRecord[]> {
  const response = await apiRequest<SanctionAppealListResponse>('/sanctions/appeals/inbox', {
    accessToken,
    searchParams: {
      institutionId: filters.institutionId,
      status: filters.status,
      limit: filters.limit ? String(filters.limit) : undefined,
    },
  });

  return response.items;
}

export async function reviewSanctionAppeal(
  accessToken: string,
  appealId: string,
  input: ReviewSanctionAppealInput,
): Promise<SanctionAppealMutationResponse> {
  return apiRequest<SanctionAppealMutationResponse>(`/sanctions/appeals/${appealId}/review`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function listReviewableActiveSanctions(
  accessToken: string,
  filters: ReviewableSanctionFilters = {},
): Promise<ReviewableOperationalSanctionRecord[]> {
  const response = await apiRequest<ReviewableSanctionListResponse>('/sanctions/inbox', {
    accessToken,
    searchParams: {
      institutionId: filters.institutionId,
      userId: filters.userId,
      limit: filters.limit ? String(filters.limit) : undefined,
    },
  });

  return response.items;
}

export async function liftOperationalSanction(
  accessToken: string,
  sanctionId: string,
  input: LiftOperationalSanctionInput,
): Promise<SanctionLiftMutationResponse> {
  return apiRequest<SanctionLiftMutationResponse>(`/sanctions/${sanctionId}/lift`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}
