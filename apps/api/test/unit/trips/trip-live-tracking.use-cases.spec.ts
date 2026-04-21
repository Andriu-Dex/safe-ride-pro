import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  TripLiveTrackingStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import type { RealtimeEventsService } from '../../../src/modules/realtime/application/services/realtime-events.service';
import { TripLifecycleMaintenanceService } from '../../../src/modules/trips/application/services/trip-lifecycle-maintenance.service';
import { GetTripLiveTrackingUseCase } from '../../../src/modules/trips/application/use-cases/get-trip-live-tracking.use-case';
import { UpdateTripLiveTrackingUseCase } from '../../../src/modules/trips/application/use-cases/update-trip-live-tracking.use-case';
import type {
  TripLiveTrackingRecord,
  TripRecord,
  TripsRepository,
} from '../../../src/modules/trips/application/ports/trips.repository';

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

function createTripLifecycleMaintenanceServiceMock(): jest.Mocked<TripLifecycleMaintenanceService> {
  return {
    reconcileTripLifecycle: jest.fn(async (trip) => trip),
    reconcileTripCollection: jest.fn(async (trips) => trips),
    filterTripsByStatuses: jest.fn((trips) => trips),
  } as unknown as jest.Mocked<TripLifecycleMaintenanceService>;
}

function createRealtimeEventsServiceMock(): jest.Mocked<RealtimeEventsService> {
  return {
    openStream: jest.fn(),
    publishTripChanged: jest.fn(),
    publishTripRequestChanged: jest.fn(),
    publishTripLiveTrackingUpdated: jest.fn(),
  } as unknown as jest.Mocked<RealtimeEventsService>;
}

function buildTrip(overrides: Partial<TripRecord> = {}): TripRecord {
  return {
    id: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    driverMembershipId: 'membership-driver',
    driverFullName: 'Conductor Uno',
    vehicleId: 'vehicle-1',
    vehiclePlate: 'ABC-123',
    vehicleDisplayName: 'Toyota Yaris',
    status: TripStatus.InProgress,
    routeMode: TripRouteMode.DirectRoute,
    originLabel: 'Huachi',
    destinationLabel: 'Centro',
    originLatitude: -1.245,
    originLongitude: -78.622,
    destinationLatitude: -1.251,
    destinationLongitude: -78.615,
    departureAt: new Date('2030-01-01T10:00:00.000Z'),
    estimatedArrivalAt: new Date('2030-01-01T10:30:00.000Z'),
    seatCount: 4,
    availableSeats: 2,
    vehicleTypeSnapshot: VehicleType.Car,
    luggagePolicySnapshot: LuggagePolicy.UpToMedium,
    basePriceReference: 2.5,
    detourSurchargeReference: null,
    notes: null,
    cancelledAt: null,
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    ...overrides,
  };
}

function buildTracking(overrides: Partial<TripLiveTrackingRecord> = {}): TripLiveTrackingRecord {
  return {
    tripId: 'trip-1',
    status: TripLiveTrackingStatus.Active,
    startedAt: new Date('2030-01-01T10:00:00.000Z'),
    endedAt: null,
    lastSignalAt: new Date('2030-01-01T10:05:00.000Z'),
    currentLatitude: -1.248,
    currentLongitude: -78.619,
    currentAccuracyMeters: 12,
    currentHeadingDegrees: 140,
    currentSpeedKph: 28,
    history: [
      {
        capturedAt: new Date('2030-01-01T10:04:30.000Z'),
        latitude: -1.247,
        longitude: -78.62,
        accuracyMeters: 10,
        headingDegrees: 132,
        speedKph: 26,
      },
    ],
    ...overrides,
  };
}

describe('Trip live tracking use cases', () => {
  it('returns live tracking to the trip owner', async () => {
    const repository = createTripsRepositoryMock();
    const tripLifecycleMaintenanceService = createTripLifecycleMaintenanceServiceMock();
    const useCase = new GetTripLiveTrackingUseCase(repository, tripLifecycleMaintenanceService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-driver',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip());
    repository.getTripLiveTrackingByTripId.mockResolvedValue(buildTracking());

    const response = await useCase.execute('user-driver', 'trip-1');

    expect(response.tripId).toBe('trip-1');
    expect(response.currentLatitude).toBe(-1.248);
    expect(response.history).toHaveLength(1);
  });

  it('rejects tracking access for users that are not confirmed participants', async () => {
    const repository = createTripsRepositoryMock();
    const tripLifecycleMaintenanceService = createTripLifecycleMaintenanceServiceMock();
    const useCase = new GetTripLiveTrackingUseCase(repository, tripLifecycleMaintenanceService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-outsider',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.NotRequested,
    });
    repository.findTripById.mockResolvedValue(buildTrip());
    repository.hasAcceptedTripRequest.mockResolvedValue(false);

    await expect(useCase.execute('user-outsider', 'trip-1')).rejects.toThrow(
      new NotFoundException('El viaje solicitado no existe.'),
    );
  });

  it('records a new driver position and publishes the live tracking event', async () => {
    const repository = createTripsRepositoryMock();
    const tripLifecycleMaintenanceService = createTripLifecycleMaintenanceServiceMock();
    const realtimeEventsService = createRealtimeEventsServiceMock();
    const useCase = new UpdateTripLiveTrackingUseCase(
      repository,
      tripLifecycleMaintenanceService,
      realtimeEventsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-driver',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip());
    repository.recordTripLiveTrackingPosition.mockResolvedValue(buildTracking());
    repository.findAcceptedPassengerMembershipIds.mockResolvedValue(['membership-passenger']);

    const capturedAt = new Date().toISOString();

    const response = await useCase.execute({
      userId: 'user-driver',
      tripId: 'trip-1',
      capturedAt,
      latitude: -1.248,
      longitude: -78.619,
      accuracyMeters: 12,
      headingDegrees: 140,
      speedKph: 28,
    });

    expect(repository.recordTripLiveTrackingPosition).toHaveBeenCalledWith({
      tripId: 'trip-1',
      capturedAt: new Date(capturedAt),
      latitude: -1.248,
      longitude: -78.619,
      accuracyMeters: 12,
      headingDegrees: 140,
      speedKph: 28,
    });
    expect(realtimeEventsService.publishTripLiveTrackingUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 'trip-1',
        driverMembershipId: 'membership-driver',
        recipientMembershipIds: ['membership-driver', 'membership-passenger'],
      }),
    );
    expect(response.currentLongitude).toBe(-78.619);
  });

  it('blocks driver tracking updates for users that do not own the trip', async () => {
    const repository = createTripsRepositoryMock();
    const tripLifecycleMaintenanceService = createTripLifecycleMaintenanceServiceMock();
    const realtimeEventsService = createRealtimeEventsServiceMock();
    const useCase = new UpdateTripLiveTrackingUseCase(
      repository,
      tripLifecycleMaintenanceService,
      realtimeEventsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-passenger',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.NotRequested,
    });
    repository.findTripById.mockResolvedValue(buildTrip());

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        capturedAt: '2030-01-01T10:05:00.000Z',
        latitude: -1.248,
        longitude: -78.619,
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'Solo el conductor propietario puede compartir seguimiento en vivo.',
      ),
    );
  });
});
