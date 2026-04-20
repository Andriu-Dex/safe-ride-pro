import { NotFoundException } from '@nestjs/common';
import {
  CancellationTiming,
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { TripLifecycleMaintenanceService } from '../../../src/modules/trips/application/services/trip-lifecycle-maintenance.service';
import { GetTripByIdUseCase } from '../../../src/modules/trips/application/use-cases/get-trip-by-id.use-case';
import type { TripRecord, TripsRepository } from '../../../src/modules/trips/application/ports/trips.repository';

function createTripsRepositoryMock(): jest.Mocked<TripsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findVehicleByIdForMembership: jest.fn(),
    createTrip: jest.fn(),
    findTripById: jest.fn(),
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
    notes: 'Ruta diaria',
    cancelledAt: null,
    cancellationTiming: CancellationTiming.OnTime,
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    ...overrides,
  };
}

describe('GetTripByIdUseCase', () => {
  it('returns precise route coordinates to the trip owner', async () => {
    const repository = createTripsRepositoryMock();
    const tripLifecycleMaintenanceService = createTripLifecycleMaintenanceServiceMock();
    const useCase = new GetTripByIdUseCase(repository, tripLifecycleMaintenanceService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-driver',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip());

    const response = await useCase.execute('user-driver', 'trip-1');

    expect(response.originLatitude).toBe(-1.245);
    expect(response.destinationLongitude).toBe(-78.615);
    expect(repository.hasAcceptedTripRequest).not.toHaveBeenCalled();
  });

  it('returns precise route coordinates to an accepted passenger', async () => {
    const repository = createTripsRepositoryMock();
    const tripLifecycleMaintenanceService = createTripLifecycleMaintenanceServiceMock();
    const useCase = new GetTripByIdUseCase(repository, tripLifecycleMaintenanceService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-passenger',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.NotRequested,
    });
    repository.findTripById.mockResolvedValue(buildTrip());
    repository.hasAcceptedTripRequest.mockResolvedValue(true);

    const response = await useCase.execute('user-passenger', 'trip-1');

    expect(response.originLongitude).toBe(-78.622);
    expect(response.destinationLatitude).toBe(-1.251);
    expect(repository.hasAcceptedTripRequest).toHaveBeenCalledWith('trip-1', 'membership-passenger');
  });

  it('hides precise route coordinates from users who are not confirmed participants', async () => {
    const repository = createTripsRepositoryMock();
    const tripLifecycleMaintenanceService = createTripLifecycleMaintenanceServiceMock();
    const useCase = new GetTripByIdUseCase(repository, tripLifecycleMaintenanceService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-observer',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.NotRequested,
    });
    repository.findTripById.mockResolvedValue(buildTrip());
    repository.hasAcceptedTripRequest.mockResolvedValue(false);

    const response = await useCase.execute('user-observer', 'trip-1');

    expect(response.originLatitude).toBeNull();
    expect(response.originLongitude).toBeNull();
    expect(response.destinationLatitude).toBeNull();
    expect(response.destinationLongitude).toBeNull();
  });

  it('rejects access when the trip belongs to another institution', async () => {
    const repository = createTripsRepositoryMock();
    const tripLifecycleMaintenanceService = createTripLifecycleMaintenanceServiceMock();
    const useCase = new GetTripByIdUseCase(repository, tripLifecycleMaintenanceService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-passenger',
      institutionId: 'institution-2',
      institutionName: 'ESPE',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.NotRequested,
    });
    repository.findTripById.mockResolvedValue(buildTrip());

    await expect(useCase.execute('user-passenger', 'trip-1')).rejects.toThrow(
      new NotFoundException('El viaje solicitado no existe.'),
    );
  });
});
