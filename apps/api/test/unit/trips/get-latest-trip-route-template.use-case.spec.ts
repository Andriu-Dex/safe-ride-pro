import { ForbiddenException } from '@nestjs/common';
import {
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { GetLatestTripRouteTemplateUseCase } from '../../../src/modules/trips/application/use-cases/get-latest-trip-route-template.use-case';
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
    completeTrip: jest.fn(),
    autoCancelTripForDriverAbsence: jest.fn(),
    cancelTripAndActiveRequests: jest.fn(),
    startTripAndClosePendingRequests: jest.fn(),
    getTripLiveTrackingByTripId: jest.fn(),
    activateTripLiveTracking: jest.fn(),
    recordTripLiveTrackingPosition: jest.fn(),
    endTripLiveTracking: jest.fn(),
  };
}

function buildTrip(): TripRecord {
  return {
    id: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    driverMembershipId: 'membership-1',
    driverFullName: 'Conductor Uno',
    vehicleId: 'vehicle-1',
    vehiclePlate: 'ABC-123',
    vehicleDisplayName: 'Kia Soluto',
    status: TripStatus.Completed,
    routeMode: TripRouteMode.DirectRoute,
    originLabel: 'Huachi',
    destinationLabel: 'Ficoa',
    originLatitude: -1.255,
    originLongitude: -78.615,
    destinationLatitude: -1.243,
    destinationLongitude: -78.621,
    departureAt: new Date('2030-01-02T13:00:00.000Z'),
    estimatedArrivalAt: new Date('2030-01-02T13:30:00.000Z'),
    seatCount: 3,
    availableSeats: 1,
    vehicleTypeSnapshot: VehicleType.Car,
    luggagePolicySnapshot: LuggagePolicy.UpToMedium,
    basePriceReference: 2.5,
    detourSurchargeReference: null,
    notes: 'Ruta habitual',
    closureNote: null,
    cancelledAt: null,
    completedAt: new Date('2030-01-02T13:31:00.000Z'),
    cancellationTiming: null,
    createdAt: new Date('2030-01-01T12:00:00.000Z'),
  };
}

describe('GetLatestTripRouteTemplateUseCase', () => {
  it('returns the latest reusable route template for the active membership', async () => {
    const repository = createTripsRepositoryMock();
    const useCase = new GetLatestTripRouteTemplateUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findLatestReusableTripByDriverMembershipId.mockResolvedValue(buildTrip());

    const response = await useCase.execute('user-1');

    expect(response).toEqual({
      sourceTripId: 'trip-1',
      vehicleId: 'vehicle-1',
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Huachi',
      destinationLabel: 'Ficoa',
      originLatitude: -1.255,
      originLongitude: -78.615,
      destinationLatitude: -1.243,
      destinationLongitude: -78.621,
      seatCount: 3,
      basePriceReference: 2.5,
      detourSurchargeReference: null,
      notes: 'Ruta habitual',
      createdAt: new Date('2030-01-01T12:00:00.000Z'),
      departureAt: new Date('2030-01-02T13:00:00.000Z'),
      vehicleDisplayName: 'Kia Soluto',
      vehiclePlate: 'ABC-123',
    });
  });

  it('rejects users without active membership context', async () => {
    const repository = createTripsRepositoryMock();
    const useCase = new GetLatestTripRouteTemplateUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue(null);

    await expect(useCase.execute('user-1')).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para reutilizar rutas.'),
    );
  });
});
