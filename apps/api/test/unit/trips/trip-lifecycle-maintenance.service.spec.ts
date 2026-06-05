import {
  CancellationTiming,
  LuggagePolicy,
  TripLiveTrackingStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { RealtimeEventsService } from '../../../src/modules/realtime/application/services/realtime-events.service';
import { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';
import { TripLifecycleMaintenanceService } from '../../../src/modules/trips/application/services/trip-lifecycle-maintenance.service';
import type { TripLiveTrackingRecord, TripRecord, TripsRepository } from '../../../src/modules/trips/application/ports/trips.repository';

function createAuditServiceMock(): jest.Mocked<AuditService> {
  const mock = Object.create(AuditService.prototype) as jest.Mocked<AuditService>;
  mock.record = jest.fn();
  return mock;
}

function createSanctionsServiceMock(): jest.Mocked<OperationalSanctionsService> {
  const mock = Object.create(OperationalSanctionsService.prototype) as jest.Mocked<OperationalSanctionsService>;
  mock.synchronizeAutomaticSanctions = jest.fn();
  return mock;
}

function createRealtimeServiceMock(): jest.Mocked<RealtimeEventsService> {
  const mock = Object.create(RealtimeEventsService.prototype) as jest.Mocked<RealtimeEventsService>;
  mock.publishTripChanged = jest.fn();
  mock.publishTripLiveTrackingUpdated = jest.fn();
  return mock;
}

function buildTripLiveTrackingRecord(overrides: Partial<TripLiveTrackingRecord> = {}): TripLiveTrackingRecord {
  return {
    tripId: 'trip-1',
    status: TripLiveTrackingStatus.Active,
    startedAt: new Date(),
    endedAt: null,
    lastSignalAt: new Date(),
    currentLatitude: -1.25,
    currentLongitude: -78.62,
    currentAccuracyMeters: 5,
    currentHeadingDegrees: 90,
    currentSpeedKph: 0,
    history: [],
    ...overrides,
  };
}

function createTripsRepositoryMock(): jest.Mocked<TripsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findVehicleByIdForMembership: jest.fn(),
    createTrip: jest.fn(),
    updateTrip: jest.fn(),
    findTripById: jest.fn(),
    countActiveRequestsForTrip: jest.fn(),
    listTripExecutionPassengers: jest.fn(),
    hasAcceptedTripRequest: jest.fn(),
    findAcceptedPassengerMembershipIds: jest.fn(),
    findLatestReusableTripByDriverMembershipId: jest.fn(),
    listRecentReusableTripsByDriverMembershipId: jest.fn(),
    listTrips: jest.fn(),
    findOverlappingTrips: jest.fn(),
    updateTripStatus: jest.fn(),
    completeTrip: jest.fn(),
    autoCancelTripForDriverAbsence: jest.fn(),
    deleteDraftTrip: jest.fn(),
    cancelTripAndActiveRequests: jest.fn(),
    startTripAndClosePendingRequests: jest.fn(),
    getTripLiveTrackingByTripId: jest.fn(),
    activateTripLiveTracking: jest.fn(),
    recordTripLiveTrackingPosition: jest.fn(),
    endTripLiveTracking: jest.fn(),
  };
}

function buildTrip(status: TripStatus, overrides: Partial<TripRecord> = {}): TripRecord {
  return {
    id: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    driverMembershipId: 'membership-1',
    driverFullName: 'Conductor Uno',
    vehicleId: 'vehicle-1',
    vehiclePlate: 'ABC-123',
    vehicleDisplayName: 'Toyota Yaris',
    status,
    routeMode: TripRouteMode.DirectRoute,
    originLabel: 'Huachi',
    destinationLabel: 'Centro',
    originLatitude: -1.25,
    originLongitude: -78.62,
    destinationLatitude: -1.24,
    destinationLongitude: -78.61,
    departureAt: new Date(Date.now() - 30 * 60_000),
    estimatedArrivalAt: new Date(Date.now() + 15 * 60_000),
    seatCount: 4,
    availableSeats: 2,
    vehicleTypeSnapshot: VehicleType.Car,
    luggagePolicySnapshot: LuggagePolicy.UpToMedium,
    basePriceReference: 2.5,
    detourSurchargeReference: null,
    notes: null,
    closureNote: null,
    cancelledAt: null,
    completedAt: null,
    cancellationTiming: null,
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    updatedAt: new Date('2030-01-01T09:00:00.000Z'),
    ...overrides,
  };
}

describe('TripLifecycleMaintenanceService', () => {
  it('auto-cancels stale published trips and triggers audit, sanctions and realtime updates', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = createAuditServiceMock();
    const sanctionsService = createSanctionsServiceMock();
    const realtimeService = createRealtimeServiceMock();
    const service = new TripLifecycleMaintenanceService(
      repository,
      auditService,
      sanctionsService,
      realtimeService,
    );

    repository.autoCancelTripForDriverAbsence.mockResolvedValue(
      buildTrip(TripStatus.Cancelled, {
        cancelledAt: new Date(),
        cancellationTiming: CancellationTiming.Late,
      }),
    );

    const response = await service.reconcileTripLifecycle(buildTrip(TripStatus.Published));

    expect(response.status).toBe(TripStatus.Cancelled);
    expect(repository.autoCancelTripForDriverAbsence).toHaveBeenCalledWith('trip-1');
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      action: AuditAction.TripCancelled,
      entityType: AuditEntityType.Trip,
      entityId: 'trip-1',
      metadata: {
        status: TripStatus.Cancelled,
        reason: 'AUTO_DRIVER_ABSENCE',
        source: 'SYSTEM',
      },
    });
    expect(sanctionsService.synchronizeAutomaticSanctions).toHaveBeenCalledWith('membership-1');
    expect(realtimeService.publishTripChanged).toHaveBeenCalledWith({
      actorUserId: 'system',
      institutionId: 'institution-1',
      reason: 'cancelled',
      tripId: 'trip-1',
    });
  });

  it('leaves non-stale trips unchanged', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = createAuditServiceMock();
    const sanctionsService = createSanctionsServiceMock();
    const realtimeService = createRealtimeServiceMock();
    const service = new TripLifecycleMaintenanceService(
      repository,
      auditService,
      sanctionsService,
      realtimeService,
    );

    const trip = buildTrip(TripStatus.Published, {
      departureAt: new Date(Date.now() + 10 * 60_000),
    });

    const response = await service.reconcileTripLifecycle(trip);

    expect(response).toBe(trip);
    expect(repository.autoCancelTripForDriverAbsence).not.toHaveBeenCalled();
  });

  it('queries repository and returns findTripById or original trip if autoCancelTripForDriverAbsence returns null', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = createAuditServiceMock();
    const sanctionsService = createSanctionsServiceMock();
    const realtimeService = createRealtimeServiceMock();
    const service = new TripLifecycleMaintenanceService(repository, auditService, sanctionsService, realtimeService);

    repository.autoCancelTripForDriverAbsence.mockResolvedValue(null);
    
    // Sub-case 1: findTripById returns a trip
    const altTrip = buildTrip(TripStatus.Published);
    repository.findTripById.mockResolvedValue(altTrip);
    const result1 = await service.reconcileTripLifecycle(buildTrip(TripStatus.Published));
    expect(result1).toBe(altTrip);

    // Sub-case 2: findTripById returns null (fallback to original trip)
    repository.findTripById.mockResolvedValue(null);
    const originalTrip = buildTrip(TripStatus.Published);
    const result2 = await service.reconcileTripLifecycle(originalTrip);
    expect(result2).toBe(originalTrip);
  });

  it('publishes live tracking update if endTripLiveTracking returns tracking info', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = createAuditServiceMock();
    const sanctionsService = createSanctionsServiceMock();
    const realtimeService = createRealtimeServiceMock();
    const service = new TripLifecycleMaintenanceService(repository, auditService, sanctionsService, realtimeService);

    const cancelledTrip = buildTrip(TripStatus.Cancelled);
    repository.autoCancelTripForDriverAbsence.mockResolvedValue(cancelledTrip);
    repository.findAcceptedPassengerMembershipIds.mockResolvedValue(['passenger-1']);

    const trackingData = buildTripLiveTrackingRecord({
      status: TripLiveTrackingStatus.Active,
    });
    repository.endTripLiveTracking.mockResolvedValue(trackingData);

    await service.reconcileTripLifecycle(buildTrip(TripStatus.Published));

    expect(realtimeService.publishTripLiveTrackingUpdated).toHaveBeenCalledWith({
      actorUserId: 'system',
      institutionId: 'institution-1',
      tripId: 'trip-1',
      driverMembershipId: 'membership-1',
      recipientMembershipIds: ['membership-1', 'passenger-1'],
      trackingStatus: TripLiveTrackingStatus.Active,
      lastSignalAt: trackingData.lastSignalAt,
      currentLatitude: -1.25,
      currentLongitude: -78.62,
      currentAccuracyMeters: 5,
      currentHeadingDegrees: 90,
      currentSpeedKph: 0,
    });
  });

  it('reconciles a collection of trips', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = createAuditServiceMock();
    const sanctionsService = createSanctionsServiceMock();
    const realtimeService = createRealtimeServiceMock();
    const service = new TripLifecycleMaintenanceService(repository, auditService, sanctionsService, realtimeService);

    const staleTrip = buildTrip(TripStatus.Published);
    const nonStaleTrip = buildTrip(TripStatus.Published, { departureAt: new Date(Date.now() + 10 * 60_000) });

    repository.autoCancelTripForDriverAbsence.mockResolvedValue(buildTrip(TripStatus.Cancelled));

    const results = await service.reconcileTripCollection([staleTrip, nonStaleTrip]);

    expect(results).toHaveLength(2);
    expect(results[0].status).toBe(TripStatus.Cancelled);
    expect(results[1]).toBe(nonStaleTrip);
  });

  it('filters trips by statuses correctly', () => {
    const repository = createTripsRepositoryMock();
    const service = new TripLifecycleMaintenanceService(
      repository,
      createAuditServiceMock(),
      createSanctionsServiceMock(),
      createRealtimeServiceMock(),
    );

    const trip1 = buildTrip(TripStatus.Published);
    const trip2 = buildTrip(TripStatus.InProgress);
    const trip3 = buildTrip(TripStatus.Cancelled);
    const trips = [trip1, trip2, trip3];

    // Case 1: no statuses filter provided
    expect(service.filterTripsByStatuses(trips)).toBe(trips);
    expect(service.filterTripsByStatuses(trips, [])).toBe(trips);

    // Case 2: statuses filter provided
    const filtered = service.filterTripsByStatuses(trips, [TripStatus.InProgress, TripStatus.Cancelled]);
    expect(filtered).toHaveLength(2);
    expect(filtered).toContain(trip2);
    expect(filtered).toContain(trip3);
    expect(filtered).not.toContain(trip1);
  });
});
