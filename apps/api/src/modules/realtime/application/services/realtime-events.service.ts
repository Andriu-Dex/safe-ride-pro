import { Injectable } from '@nestjs/common';
import {
  getTripLiveTrackingSignalStatus,
  type RealtimeConnectedEvent,
  REALTIME_CONNECTED_EVENT,
  REALTIME_NOTIFICATION_CREATED_EVENT,
  REALTIME_TRIP_LIVE_TRACKING_UPDATED_EVENT,
  REALTIME_TRIP_CHANGED_EVENT,
  REALTIME_TRIP_REQUEST_CHANGED_EVENT,
  type AppNotificationRecord,
  type RealtimeEvent,
  type RealtimeTripChangeReason,
  type RealtimeTripLiveTrackingUpdatedEvent,
  type RealtimeTripRequestChangeReason,
  type TripLiveTrackingStatus,
} from '@saferidepro/shared-types';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';

type StreamRequest = IncomingMessage;
type StreamResponse = ServerResponse<IncomingMessage> & {
  destroyed: boolean;
  flushHeaders?: () => void;
};

type RealtimeConnection = {
  id: string;
  heartbeat: NodeJS.Timeout;
  institutionIds: string[];
  membershipIds: string[];
  response: StreamResponse;
  userId: string;
};

@Injectable()
export class RealtimeEventsService {
  private static readonly HEARTBEAT_INTERVAL_MS = 25_000;

  private readonly connections = new Map<string, RealtimeConnection>();

  openStream(
    currentUser: CurrentUserContext,
    request: StreamRequest,
    response: StreamResponse,
  ): void {
    const connectionId = randomUUID();
    const institutionIds = Array.from(
      new Set(
        currentUser.memberships
          .filter(
            (membership) =>
              membership.membershipStatus === 'ACTIVE' &&
              membership.institutionIsActive !== false,
          )
          .map((membership) => membership.institutionId),
      ),
    );
    const membershipIds = Array.from(
      new Set(
        currentUser.memberships
          .filter(
            (membership) =>
              membership.membershipStatus === 'ACTIVE' &&
              membership.institutionIsActive !== false,
          )
          .map((membership) => membership.id),
      ),
    );

    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
    response.write('retry: 5000\n\n');

    const heartbeat = setInterval(() => {
      this.writeRaw(response, ': ping\n\n');
    }, RealtimeEventsService.HEARTBEAT_INTERVAL_MS);

    this.connections.set(connectionId, {
      id: connectionId,
      heartbeat,
      institutionIds,
      membershipIds,
      response,
      userId: currentUser.id,
    });

    const connectedEvent: RealtimeConnectedEvent = {
      type: REALTIME_CONNECTED_EVENT,
      connectedAt: new Date().toISOString(),
      userId: currentUser.id,
      institutionIds,
      membershipIds,
    };

    this.sendEvent(response, REALTIME_CONNECTED_EVENT, connectedEvent);

    const cleanup = () => {
      const connection = this.connections.get(connectionId);

      if (!connection) {
        return;
      }

      clearInterval(connection.heartbeat);
      this.connections.delete(connectionId);
    };

    request.on('close', cleanup);
    response.on('close', cleanup);
    response.on('error', cleanup);
  }

  publishTripChanged(input: {
    actorUserId: string;
    institutionId: string;
    reason: RealtimeTripChangeReason;
    tripId: string;
  }): void {
    this.publish({
      type: REALTIME_TRIP_CHANGED_EVENT,
      actorUserId: input.actorUserId,
      institutionId: input.institutionId,
      occurredAt: new Date().toISOString(),
      reason: input.reason,
      tripId: input.tripId,
    });
  }

  publishNotificationCreated(input: {
    institutionId: string;
    recipientMembershipId: string;
    notification: AppNotificationRecord;
  }): void {
    this.publish({
      type: REALTIME_NOTIFICATION_CREATED_EVENT,
      institutionId: input.institutionId,
      occurredAt: new Date().toISOString(),
      notification: input.notification,
      recipientMembershipId: input.recipientMembershipId,
    });
  }

  publishTripRequestChanged(input: {
    actorUserId: string;
    driverMembershipId: string;
    institutionId: string;
    passengerMembershipId: string;
    reason: RealtimeTripRequestChangeReason;
    requestId: string;
    tripId: string;
  }): void {
    this.publish({
      type: REALTIME_TRIP_REQUEST_CHANGED_EVENT,
      actorUserId: input.actorUserId,
      driverMembershipId: input.driverMembershipId,
      institutionId: input.institutionId,
      occurredAt: new Date().toISOString(),
      passengerMembershipId: input.passengerMembershipId,
      reason: input.reason,
      requestId: input.requestId,
      tripId: input.tripId,
    });
  }

  publishTripLiveTrackingUpdated(input: {
    actorUserId: string;
    institutionId: string;
    tripId: string;
    driverMembershipId: string;
    recipientMembershipIds: string[];
    trackingStatus: TripLiveTrackingStatus;
    lastSignalAt: Date | null;
    currentLatitude: number | null;
    currentLongitude: number | null;
    currentAccuracyMeters: number | null;
    currentHeadingDegrees: number | null;
    currentSpeedKph: number | null;
  }): void {
    const lastSignalAt = input.lastSignalAt?.toISOString() ?? null;

    this.publish({
      type: REALTIME_TRIP_LIVE_TRACKING_UPDATED_EVENT,
      actorUserId: input.actorUserId,
      driverMembershipId: input.driverMembershipId,
      institutionId: input.institutionId,
      occurredAt: new Date().toISOString(),
      recipientMembershipIds: Array.from(new Set(input.recipientMembershipIds)),
      tripId: input.tripId,
      trackingStatus: input.trackingStatus,
      signalStatus: getTripLiveTrackingSignalStatus({
        status: input.trackingStatus,
        lastSignalAt,
      }),
      lastSignalAt,
      currentLatitude: input.currentLatitude,
      currentLongitude: input.currentLongitude,
      currentAccuracyMeters: input.currentAccuracyMeters,
      currentHeadingDegrees: input.currentHeadingDegrees,
      currentSpeedKph: input.currentSpeedKph,
    });
  }

  private publish(event: RealtimeEvent): void {
    for (const connection of this.connections.values()) {
      if (!this.shouldReceiveEvent(connection, event)) {
        continue;
      }

      this.sendEvent(connection.response, event.type, event);
    }
  }

  private shouldReceiveEvent(
    connection: RealtimeConnection,
    event: RealtimeEvent,
  ): boolean {
    if (event.type === REALTIME_CONNECTED_EVENT) {
      return connection.userId === event.userId;
    }

    if (!connection.institutionIds.includes(event.institutionId)) {
      return false;
    }

    if (event.type === REALTIME_NOTIFICATION_CREATED_EVENT) {
      return connection.membershipIds.includes(event.recipientMembershipId);
    }

    if (event.type === REALTIME_TRIP_REQUEST_CHANGED_EVENT) {
      return (
        connection.membershipIds.includes(event.driverMembershipId) ||
        connection.membershipIds.includes(event.passengerMembershipId) ||
        connection.institutionIds.includes(event.institutionId)
      );
    }

    if (event.type === REALTIME_TRIP_LIVE_TRACKING_UPDATED_EVENT) {
      return event.recipientMembershipIds.some((membershipId) =>
        connection.membershipIds.includes(membershipId),
      );
    }

    return true;
  }

  private sendEvent(response: StreamResponse, eventName: string, event: RealtimeEvent): void {
    this.writeRaw(
      response,
      `event: ${eventName}\ndata: ${JSON.stringify(event)}\n\n`,
    );
  }

  private writeRaw(response: StreamResponse, chunk: string): void {
    if (response.writableEnded || response.destroyed) {
      return;
    }

    response.write(chunk);
  }
}
