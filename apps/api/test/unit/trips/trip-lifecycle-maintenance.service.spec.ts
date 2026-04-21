import {
  CancellationTiming,
  LuggagePolicy,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { RealtimeEventsService } from '../../../src/modules/realtime/application/services/realtime-events.service';
import { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';
import { TripLifecycleMaintenanceService } from '../../../src/modules/trips/application/services/trip-lifecycle-maintenance.service';
import type { TripRecord, TripsRepository } from '../../../src/modules/trips/application/ports/trips.repository';

function createTripsRepositoryMock(): jest.Mocked<TripsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findVehicleByIdForMembership: jest.fn(),
    createTrip: jest.fn(),
    findTripById: jest.fn(),
    listTripExecutionPassengers: jest.fn(),
    hasAcceptedTripRequest: jest.fn(),
    findAcceptedPassengerMembershipIds: jest.fn(),
    findLatestReusableTripByDriverMembershipId: jest.fn(),
    listTrips: jest.fn(),
    findOverlappingTrips: jest.fn(),
    updateTripStatus: jest.fn(),
    autoCancelTripForDriverAbsence: jest.fn(),
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
    cancelledAt: null,
    cancellationTiming: null,
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    ...overrides,
  };
}

describe('TripLifecycleMaintenanceService', () => {
  it('auto-cancels stale published trips and triggers audit, sanctions and realtime updates', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = {
      synchronizeAutomaticSanctions: jest.fn(),
    } as unknown as jest.Mocked<OperationalSanctionsService>;
    const realtimeService = {
      publishTripChanged: jest.fn(),
    } as unknown as jest.Mocked<RealtimeEventsService>;
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
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = {
      synchronizeAutomaticSanctions: jest.fn(),
    } as unknown as jest.Mocked<OperationalSanctionsService>;
    const realtimeService = {
      publishTripChanged: jest.fn(),
    } as unknown as jest.Mocked<RealtimeEventsService>;
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
});
