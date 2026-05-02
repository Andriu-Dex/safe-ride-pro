import type {
  TripLiveTrackingSignalStatus,
  TripLiveTrackingStatus,
} from './trip-live-tracking';
import type { AppNotificationRecord } from './notification';

export const REALTIME_CONNECTED_EVENT = 'connected' as const;
export const REALTIME_NOTIFICATION_CREATED_EVENT = 'notification.created' as const;
export const REALTIME_TRIP_CHANGED_EVENT = 'trip.changed' as const;
export const REALTIME_TRIP_REQUEST_CHANGED_EVENT = 'trip-request.changed' as const;
export const REALTIME_TRIP_LIVE_TRACKING_UPDATED_EVENT =
  'trip-live-tracking.updated' as const;

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
  | 'no_show'
  | 'boarded'
  | 'dropped_off';

export type RealtimeConnectedEvent = {
  type: typeof REALTIME_CONNECTED_EVENT;
  connectedAt: string;
  userId: string;
  institutionIds: string[];
  membershipIds: string[];
};

export type RealtimeNotificationCreatedEvent = {
  type: typeof REALTIME_NOTIFICATION_CREATED_EVENT;
  institutionId: string;
  recipientMembershipId: string;
  notification: AppNotificationRecord;
  occurredAt: string;
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

export type RealtimeTripLiveTrackingUpdatedEvent = {
  type: typeof REALTIME_TRIP_LIVE_TRACKING_UPDATED_EVENT;
  institutionId: string;
  tripId: string;
  driverMembershipId: string;
  recipientMembershipIds: string[];
  actorUserId: string;
  occurredAt: string;
  trackingStatus: TripLiveTrackingStatus;
  signalStatus: TripLiveTrackingSignalStatus;
  lastSignalAt: string | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  currentAccuracyMeters: number | null;
  currentHeadingDegrees: number | null;
  currentSpeedKph: number | null;
};

export type RealtimeEvent =
  | RealtimeConnectedEvent
  | RealtimeNotificationCreatedEvent
  | RealtimeTripChangedEvent
  | RealtimeTripRequestChangedEvent
  | RealtimeTripLiveTrackingUpdatedEvent;
