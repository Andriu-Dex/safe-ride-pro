import { BadRequestException } from '@nestjs/common';
import {
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';
import type {
  TripRecord,
  TripsRepository,
  UpdateTripInput,
} from '../../../src/modules/trips/application/ports/trips.repository';
import { UpdateTripUseCase } from '../../../src/modules/trips/application/use-cases/update-trip.use-case';

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

function createOperationalSanctionsServiceMock(): jest.Mocked<OperationalSanctionsService> {
  return {
    synchronizeAutomaticSanctions: jest.fn(),
    getRecentSanctionHistory: jest.fn(),
    assertPassengerOperationsAllowed: jest.fn(),
    assertDriverOperationsAllowed: jest.fn(),
  } as unknown as jest.Mocked<OperationalSanctionsService>;
}

function buildTrip(overrides: Partial<TripRecord> = {}): TripRecord {
  return {
    id: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    driverMembershipId: 'membership-1',
    driverFullName: 'Conductor Uno',
    vehicleId: 'vehicle-1',
    vehiclePlate: 'ABC-123',
    vehicleDisplayName: 'Nissan Sentra',
    status: TripStatus.Draft,
    routeMode: TripRouteMode.DirectRoute,
    originLabel: 'Huachi',
    destinationLabel: 'Santa Rosa',
    originLatitude: -1.25,
    originLongitude: -78.62,
    destinationLatitude: -1.23,
    destinationLongitude: -78.6,
    departureAt: new Date('2030-01-01T10:00:00.000Z'),
    estimatedArrivalAt: new Date('2030-01-01T10:30:00.000Z'),
    seatCount: 4,
    availableSeats: 4,
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

function buildCommand() {
  return {
    userId: 'user-1',
    tripId: 'trip-1',
    vehicleId: 'vehicle-1',
    routeMode: TripRouteMode.DirectRoute,
    originLabel: 'Universidad Tecnica de Ambato Campus Huachi',
    destinationLabel: 'Santa Rosa',
    originLatitude: -1.25,
    originLongitude: -78.62,
    destinationLatitude: -1.23,
    destinationLongitude: -78.6,
    departureAt: '2030-01-01T11:00:00.000Z',
    estimatedArrivalAt: '2030-01-01T11:30:00.000Z',
    seatCount: 4,
    basePriceReference: 1,
  };
}

describe('UpdateTripUseCase', () => {
  it('updates an unpublished draft without blocking by active request count', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new UpdateTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip({ status: TripStatus.Draft }));
    repository.findVehicleByIdForMembership.mockResolvedValue({
      id: 'vehicle-1',
      membershipId: 'membership-1',
      isActive: true,
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      vehicleType: VehicleType.Car,
      plate: 'ABC-123',
      displayName: 'Nissan Sentra',
    });
    repository.findOverlappingTrips.mockResolvedValue([]);
    repository.updateTrip.mockImplementation(async (input: UpdateTripInput) =>
      buildTrip({
        status: input.status,
        originLabel: input.originLabel,
        destinationLabel: input.destinationLabel,
        departureAt: input.departureAt,
        estimatedArrivalAt: input.estimatedArrivalAt,
        basePriceReference: input.basePriceReference,
      }),
    );

    const response = await useCase.execute(buildCommand());

    expect(response.trip.status).toBe(TripStatus.Draft);
    expect(repository.countActiveRequestsForTrip).not.toHaveBeenCalled();
    expect(repository.updateTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TripStatus.Draft,
        originLabel: 'Universidad Tecnica de Ambato Campus Huachi',
        destinationLabel: 'Santa Rosa',
      }),
    );
  });

  it('updates an expired draft when the edited departure remains in the past', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new UpdateTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(
      buildTrip({
        status: TripStatus.Draft,
        departureAt: new Date('2020-01-01T10:00:00.000Z'),
        estimatedArrivalAt: new Date('2020-01-01T10:30:00.000Z'),
      }),
    );
    repository.findVehicleByIdForMembership.mockResolvedValue({
      id: 'vehicle-1',
      membershipId: 'membership-1',
      isActive: true,
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      vehicleType: VehicleType.Car,
      plate: 'ABC-123',
      displayName: 'Nissan Sentra',
    });
    repository.findOverlappingTrips.mockResolvedValue([]);
    repository.updateTrip.mockImplementation(async (input: UpdateTripInput) =>
      buildTrip({
        status: input.status,
        departureAt: input.departureAt,
        estimatedArrivalAt: input.estimatedArrivalAt,
      }),
    );

    const response = await useCase.execute({
      ...buildCommand(),
      departureAt: '2020-01-01T11:00:00.000Z',
      estimatedArrivalAt: '2020-01-01T11:30:00.000Z',
    });

    expect(response.trip.status).toBe(TripStatus.Draft);
    expect(repository.updateTrip).toHaveBeenCalled();
  });

  it('keeps blocking published trips with active requests', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new UpdateTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip({ status: TripStatus.Published }));
    repository.countActiveRequestsForTrip.mockResolvedValue(1);

    await expect(useCase.execute(buildCommand())).rejects.toThrow(
      new BadRequestException(
        'No puedes editar un viaje que ya tiene solicitudes activas o pasajeros confirmados.',
      ),
    );
    expect(repository.updateTrip).not.toHaveBeenCalled();
  });
});
