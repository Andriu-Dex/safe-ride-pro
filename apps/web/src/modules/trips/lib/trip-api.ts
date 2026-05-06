import type {
  CreateTripInput,
  TripDetailRecord,
  RecentTripRouteTemplate,
  TripFilters,
  TripLiveTrackingRecord,
  TripRecord,
  UpdateTripInput,
  UpdateTripLiveTrackingInput,
} from '../types/trip';
import { apiRequest } from '../../../lib/api-client';

type TripMutationResponse = {
  message: string;
  trip: TripRecord;
};

function mapTripFilters(filters?: TripFilters): Record<string, string | undefined> {
  return {
    origin: filters?.origin?.trim() || undefined,
    destination: filters?.destination?.trim() || undefined,
    dateFrom: filters?.dateFrom || undefined,
    dateTo: filters?.dateTo || undefined,
    timeFrom: filters?.timeFrom || undefined,
    timeTo: filters?.timeTo || undefined,
    routeMode: filters?.routeMode,
    vehicleType: filters?.vehicleType,
    availability: filters?.availability,
  };
}

export async function listMyTrips(
  accessToken: string,
  filters?: TripFilters,
): Promise<TripRecord[]> {
  return apiRequest<TripRecord[]>('/trips', {
    accessToken,
    searchParams: {
      mine: 'true',
      ...mapTripFilters(filters),
    },
  });
}

export async function listAvailableTrips(
  accessToken: string,
  filters?: TripFilters,
): Promise<TripRecord[]> {
  return apiRequest<TripRecord[]>('/trips', {
    accessToken,
    searchParams: mapTripFilters(filters),
  });
}

export async function createTrip(accessToken: string, input: CreateTripInput): Promise<TripMutationResponse> {
  return apiRequest<TripMutationResponse>('/trips', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateTrip(
  accessToken: string,
  tripId: string,
  input: UpdateTripInput,
): Promise<TripMutationResponse> {
  return apiRequest<TripMutationResponse>(`/trips/${tripId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function listRecentTripRouteTemplates(
  accessToken: string,
): Promise<RecentTripRouteTemplate[]> {
  return apiRequest<RecentTripRouteTemplate[]>('/trips/templates/recent', {
    accessToken,
  });
}

export async function getTripById(
  accessToken: string,
  tripId: string,
): Promise<TripDetailRecord> {
  return apiRequest<TripDetailRecord>(`/trips/${tripId}`, {
    accessToken,
  });
}

export async function getTripLiveTracking(
  accessToken: string,
  tripId: string,
): Promise<TripLiveTrackingRecord> {
  return apiRequest<TripLiveTrackingRecord>(`/trips/${tripId}/live-tracking`, {
    accessToken,
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
    body: {},
  });
}

export async function completeTripWithClosure(
  accessToken: string,
  tripId: string,
  closureNote?: string,
): Promise<TripMutationResponse> {
  return apiRequest<TripMutationResponse>(`/trips/${tripId}/complete`, {
    method: 'PATCH',
    accessToken,
    body: {
      closureNote,
    },
  });
}

export async function cancelTrip(accessToken: string, tripId: string): Promise<TripMutationResponse> {
  return apiRequest<TripMutationResponse>(`/trips/${tripId}/cancel`, {
    method: 'PATCH',
    accessToken,
  });
}

export async function updateTripLiveTracking(
  accessToken: string,
  tripId: string,
  input: UpdateTripLiveTrackingInput,
): Promise<TripLiveTrackingRecord> {
  return apiRequest<TripLiveTrackingRecord>(`/trips/${tripId}/live-tracking/positions`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}
