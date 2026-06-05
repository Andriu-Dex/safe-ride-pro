import { EventEmitter } from 'node:events';
import { RealtimeEventsService } from '../../../src/modules/realtime/application/services/realtime-events.service';
import {
  GlobalUserRole,
  REALTIME_CONNECTED_EVENT,
  REALTIME_TRIP_CHANGED_EVENT,
  REALTIME_NOTIFICATION_CREATED_EVENT,
  REALTIME_TRIP_REQUEST_CHANGED_EVENT,
  REALTIME_TRIP_LIVE_TRACKING_UPDATED_EVENT,
  TripLiveTrackingStatus,
  MembershipStatus,
} from '@saferidepro/shared-types';
import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';

class MockRequest extends EventEmitter {
  // empty mock
}

class MockResponse extends EventEmitter {
  statusCode?: number;
  headers: Record<string, string> = {};
  writableEnded = false;
  destroyed = false;
  writtenData: string[] = [];

  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  flushHeaders = jest.fn();
  write(chunk: string) {
    this.writtenData.push(chunk);
    return true;
  }
}

function buildUserContext(overrides: Partial<CurrentUserContext> = {}): CurrentUserContext {
  return {
    id: 'user-1',
    email: 'test@saferidepro.com',
    fullName: 'Test User',
    globalRole: GlobalUserRole.User,
    accountStatus: 'ACTIVE' as any,
    memberships: [
      {
        id: 'membership-1',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        institutionIsActive: true,
        role: 'STUDENT' as any,
        membershipStatus: MembershipStatus.Active,
        studentCode: '001',
        isDefault: true,
        driverVerificationStatus: 'NOT_REQUESTED' as any,
      },
    ],
    ...overrides,
  };
}

describe('RealtimeEventsService', () => {
  let service: RealtimeEventsService;

  beforeEach(() => {
    service = new RealtimeEventsService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens a stream, sets SSE headers, and sends connection event & heartbeat ping', () => {
    jest.useFakeTimers();
    const currentUser = buildUserContext();
    const req = new MockRequest() as any;
    const res = new MockResponse() as any;

    service.openStream(currentUser, req, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toBe('text/event-stream');
    expect(res.headers['Cache-Control']).toBe('no-cache, no-transform');
    expect(res.headers['Connection']).toBe('keep-alive');
    expect(res.flushHeaders).toHaveBeenCalled();

    // Check retry output
    expect(res.writtenData[0]).toBe('retry: 5000\n\n');

    // Check connection event
    const connectionEventStr = res.writtenData[1];
    expect(connectionEventStr).toContain(`event: ${REALTIME_CONNECTED_EVENT}`);
    expect(connectionEventStr).toContain(`"userId":"user-1"`);
    expect(connectionEventStr).toContain(`"institutionIds":["institution-1"]`);
    expect(connectionEventStr).toContain(`"membershipIds":["membership-1"]`);

    // Advance timers by 25s for heartbeat
    jest.advanceTimersByTime(25000);
    expect(res.writtenData[2]).toBe(': ping\n\n');
  });

  it('cleans up resources and deletes connection when request triggers close', () => {
    jest.useFakeTimers();
    const currentUser = buildUserContext();
    const req = new MockRequest() as any;
    const res = new MockResponse() as any;

    service.openStream(currentUser, req, res);

    // Trigger cleanup via req close
    req.emit('close');

    // Advance timer to verify interval is cleared (no new pings written)
    jest.advanceTimersByTime(25000);
    expect(res.writtenData.filter((d: string) => d === ': ping\n\n')).toHaveLength(0);
  });

  it('cleans up resources when response triggers error or close', () => {
    jest.useFakeTimers();
    const currentUser = buildUserContext();
    const req = new MockRequest() as any;
    const res = new MockResponse() as any;

    service.openStream(currentUser, req, res);

    // Trigger cleanup via res error
    res.emit('error', new Error('stream error'));

    jest.advanceTimersByTime(25000);
    expect(res.writtenData.filter((d: string) => d === ': ping\n\n')).toHaveLength(0);
  });

  it('filters out notifications that do not match recipientMembershipId', () => {
    const user1 = buildUserContext({ id: 'user-1' });
    const user2 = buildUserContext({
      id: 'user-2',
      memberships: [
        {
          id: 'membership-2',
          institutionId: 'institution-1',
          institutionName: 'UTA',
          institutionIsActive: true,
          role: 'STUDENT' as any,
          membershipStatus: MembershipStatus.Active,
          studentCode: '002',
          isDefault: true,
          driverVerificationStatus: 'NOT_REQUESTED' as any,
        },
      ],
    });

    const res1 = new MockResponse() as any;
    const res2 = new MockResponse() as any;

    service.openStream(user1, new MockRequest() as any, res1);
    service.openStream(user2, new MockRequest() as any, res2);

    // Clear initial connected event data
    res1.writtenData = [];
    res2.writtenData = [];

    service.publishNotificationCreated({
      institutionId: 'institution-1',
      recipientMembershipId: 'membership-2',
      notification: {
        id: 'notif-1',
        title: 'Hola',
        content: 'Test',
        createdAt: new Date(),
        readAt: null,
      } as any,
    });

    // res1 should NOT have received it, res2 SHOULD
    expect(res1.writtenData).toHaveLength(0);
    expect(res2.writtenData).toHaveLength(1);
    expect(res2.writtenData[0]).toContain(REALTIME_NOTIFICATION_CREATED_EVENT);
  });

  it('filters out trip requests changes based on institutionId or membershipIds', () => {
    const user1 = buildUserContext({ id: 'user-1' }); // membership-1 on institution-1
    const userOtherInst = buildUserContext({
      id: 'user-2',
      memberships: [
        {
          id: 'membership-2',
          institutionId: 'institution-2',
          institutionName: 'ESPEL',
          institutionIsActive: true,
          role: 'STUDENT' as any,
          membershipStatus: MembershipStatus.Active,
          studentCode: '002',
          isDefault: true,
          driverVerificationStatus: 'NOT_REQUESTED' as any,
        },
      ],
    });

    const res1 = new MockResponse() as any;
    const res2 = new MockResponse() as any;

    service.openStream(user1, new MockRequest() as any, res1);
    service.openStream(userOtherInst, new MockRequest() as any, res2);

    res1.writtenData = [];
    res2.writtenData = [];

    service.publishTripRequestChanged({
      tripId: 'trip-1',
      requestId: 'req-1',
      actorUserId: 'actor-1',
      driverMembershipId: 'membership-driver',
      passengerMembershipId: 'membership-1',
      institutionId: 'institution-1',
      reason: 'accepted',
    });

    // res1 should receive it (passenger matches), res2 should NOT (institution matches user1 but not user2)
    expect(res1.writtenData).toHaveLength(1);
    expect(res1.writtenData[0]).toContain(REALTIME_TRIP_REQUEST_CHANGED_EVENT);
    expect(res2.writtenData).toHaveLength(0);
  });

  it('filters trip changes by institutionId', () => {
    const user1 = buildUserContext({ id: 'user-1' });
    const userOtherInst = buildUserContext({
      id: 'user-2',
      memberships: [
        {
          id: 'membership-2',
          institutionId: 'institution-2',
          institutionName: 'ESPEL',
          institutionIsActive: true,
          role: 'STUDENT' as any,
          membershipStatus: MembershipStatus.Active,
          studentCode: '002',
          isDefault: true,
          driverVerificationStatus: 'NOT_REQUESTED' as any,
        },
      ],
    });

    const res1 = new MockResponse() as any;
    const res2 = new MockResponse() as any;

    service.openStream(user1, new MockRequest() as any, res1);
    service.openStream(userOtherInst, new MockRequest() as any, res2);

    res1.writtenData = [];
    res2.writtenData = [];

    service.publishTripChanged({
      tripId: 'trip-1',
      actorUserId: 'user-1',
      institutionId: 'institution-1',
      reason: 'cancelled',
    });

    expect(res1.writtenData).toHaveLength(1);
    expect(res1.writtenData[0]).toContain(REALTIME_TRIP_CHANGED_EVENT);
    expect(res2.writtenData).toHaveLength(0);
  });

  it('publishes live tracking update only to matching recipientMembershipIds', () => {
    const user1 = buildUserContext({ id: 'user-1' }); // membership-1
    const user2 = buildUserContext({
      id: 'user-2',
      memberships: [
        {
          id: 'membership-2',
          institutionId: 'institution-1',
          institutionName: 'UTA',
          institutionIsActive: true,
          role: 'STUDENT' as any,
          membershipStatus: MembershipStatus.Active,
          studentCode: '002',
          isDefault: true,
          driverVerificationStatus: 'NOT_REQUESTED' as any,
        },
      ],
    });

    const res1 = new MockResponse() as any;
    const res2 = new MockResponse() as any;

    service.openStream(user1, new MockRequest() as any, res1);
    service.openStream(user2, new MockRequest() as any, res2);

    res1.writtenData = [];
    res2.writtenData = [];

    service.publishTripLiveTrackingUpdated({
      tripId: 'trip-1',
      actorUserId: 'driver-1',
      driverMembershipId: 'membership-driver',
      institutionId: 'institution-1',
      recipientMembershipIds: ['membership-1'], // user1 is the only recipient
      trackingStatus: TripLiveTrackingStatus.Active,
      lastSignalAt: new Date(),
      currentLatitude: -1.25,
      currentLongitude: -78.6,
      currentAccuracyMeters: 10,
      currentHeadingDegrees: 90,
      currentSpeedKph: 50,
    });

    expect(res1.writtenData).toHaveLength(1);
    expect(res1.writtenData[0]).toContain(REALTIME_TRIP_LIVE_TRACKING_UPDATED_EVENT);
    expect(res2.writtenData).toHaveLength(0);
  });

  it('does not write to closed or destroyed responses', () => {
    const currentUser = buildUserContext();
    const req = new MockRequest() as any;
    const res = new MockResponse() as any;

    service.openStream(currentUser, req, res);
    res.writtenData = [];

    // Simulate response closed/ended
    res.writableEnded = true;

    service.publishTripChanged({
      tripId: 'trip-1',
      actorUserId: 'user-1',
      institutionId: 'institution-1',
      reason: 'started',
    });

    expect(res.writtenData).toHaveLength(0);
  });
});
