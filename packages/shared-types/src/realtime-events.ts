export const REALTIME_CONNECTED_EVENT = 'connected' as const;
export const REALTIME_TRIP_CHANGED_EVENT = 'trip.changed' as const;
export const REALTIME_TRIP_REQUEST_CHANGED_EVENT = 'trip-request.changed' as const;

export type RealtimeTripChangeReason =
  | 'created'
  | 'published'
  | 'started'
  | 'completed'
  | 'cancelled';

export type RealtimeTripRequestChangeReason =
  | 'created'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'no_show';

export type RealtimeConnectedEvent = {
  type: typeof REALTIME_CONNECTED_EVENT;
  connectedAt: string;
  userId: string;
  institutionIds: string[];
  membershipIds: string[];
};

export type RealtimeTripChangedEvent = {
  type: typeof REALTIME_TRIP_CHANGED_EVENT;
  reason: RealtimeTripChangeReason;
  institutionId: string;
  tripId: string;
  actorUserId: string;
  occurredAt: string;
};

export type RealtimeTripRequestChangedEvent = {
  type: typeof REALTIME_TRIP_REQUEST_CHANGED_EVENT;
  reason: RealtimeTripRequestChangeReason;
  institutionId: string;
  tripId: string;
  requestId: string;
  driverMembershipId: string;
  passengerMembershipId: string;
  actorUserId: string;
  occurredAt: string;
};

export type RealtimeEvent =
  | RealtimeConnectedEvent
  | RealtimeTripChangedEvent
  | RealtimeTripRequestChangedEvent;
