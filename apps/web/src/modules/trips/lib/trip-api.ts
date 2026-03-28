import type { CreateTripInput, TripRecord } from '../types/trip';
import { apiRequest } from '../../../lib/api-client';

type TripMutationResponse = {
  message: string;
  trip: TripRecord;
};

export async function listMyTrips(accessToken: string): Promise<TripRecord[]> {
  return apiRequest<TripRecord[]>('/trips', {
    accessToken,
    searchParams: {
      mine: 'true',
    },
  });
}

export async function listAvailableTrips(accessToken: string): Promise<TripRecord[]> {
  return apiRequest<TripRecord[]>('/trips', {
    accessToken,
  });
}

export async function createTrip(accessToken: string, input: CreateTripInput): Promise<TripMutationResponse> {
  return apiRequest<TripMutationResponse>('/trips', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function publishTrip(accessToken: string, tripId: string): Promise<TripMutationResponse> {
  return apiRequest<TripMutationResponse>(`/trips/${tripId}/publish`, {
    method: 'PATCH',
    accessToken,
  });
}

export async function startTrip(accessToken: string, tripId: string): Promise<TripMutationResponse> {
  return apiRequest<TripMutationResponse>(`/trips/${tripId}/start`, {
    method: 'PATCH',
    accessToken,
  });
}

export async function completeTrip(accessToken: string, tripId: string): Promise<TripMutationResponse> {
  return apiRequest<TripMutationResponse>(`/trips/${tripId}/complete`, {
    method: 'PATCH',
    accessToken,
  });
}

export async function cancelTrip(accessToken: string, tripId: string): Promise<TripMutationResponse> {
  return apiRequest<TripMutationResponse>(`/trips/${tripId}/cancel`, {
    method: 'PATCH',
    accessToken,
  });
}
