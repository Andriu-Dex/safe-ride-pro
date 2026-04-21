import type { CreateTripRequestInput, TripRequestRecord } from '../types/trip-request';
import { apiRequest } from '../../../lib/api-client';

type TripRequestMutationResponse = {
  message: string;
  tripRequest: TripRequestRecord;
};

type TripRequestListResponse = {
  items: TripRequestRecord[];
};

export async function listMyTripRequests(accessToken: string): Promise<TripRequestRecord[]> {
  const response = await apiRequest<TripRequestListResponse>('/trip-requests/me', {
    accessToken,
  });

  return response.items;
}

export async function listIncomingTripRequests(accessToken: string): Promise<TripRequestRecord[]> {
  const response = await apiRequest<TripRequestListResponse>('/trip-requests/driver', {
    accessToken,
  });

  return response.items;
}

export async function createTripRequest(
  accessToken: string,
  input: CreateTripRequestInput,
): Promise<TripRequestMutationResponse> {
  return apiRequest<TripRequestMutationResponse>('/trip-requests', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function acceptTripRequest(accessToken: string, requestId: string): Promise<TripRequestMutationResponse> {
  return apiRequest<TripRequestMutationResponse>(`/trip-requests/${requestId}/accept`, {
    method: 'PATCH',
    accessToken,
    body: {},
  });
}

export async function rejectTripRequest(accessToken: string, requestId: string): Promise<TripRequestMutationResponse> {
  return apiRequest<TripRequestMutationResponse>(`/trip-requests/${requestId}/reject`, {
    method: 'PATCH',
    accessToken,
    body: {},
  });
}

export async function cancelTripRequest(accessToken: string, requestId: string): Promise<TripRequestMutationResponse> {
  return apiRequest<TripRequestMutationResponse>(`/trip-requests/${requestId}/cancel`, {
    method: 'PATCH',
    accessToken,
  });
}

export async function markTripRequestBoarded(
  accessToken: string,
  requestId: string,
): Promise<TripRequestMutationResponse> {
  return apiRequest<TripRequestMutationResponse>(`/trip-requests/${requestId}/boarded`, {
    method: 'PATCH',
    accessToken,
    body: {},
  });
}

export async function markTripRequestDroppedOff(
  accessToken: string,
  requestId: string,
): Promise<TripRequestMutationResponse> {
  return apiRequest<TripRequestMutationResponse>(`/trip-requests/${requestId}/dropped-off`, {
    method: 'PATCH',
    accessToken,
    body: {},
  });
}

export async function markTripRequestAsNoShow(
  accessToken: string,
  requestId: string,
  reviewNote: string,
): Promise<TripRequestMutationResponse> {
  return apiRequest<TripRequestMutationResponse>(`/trip-requests/${requestId}/no-show`, {
    method: 'PATCH',
    accessToken,
    body: {
      reviewNote,
    },
  });
}
