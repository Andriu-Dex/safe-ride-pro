import { BadRequestException } from '@nestjs/common';
import {
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { CompleteTripUseCase } from '../../../src/modules/trips/application/use-cases/complete-trip.use-case';
import { PublishTripUseCase } from '../../../src/modules/trips/application/use-cases/publish-trip.use-case';
import { StartTripUseCase } from '../../../src/modules/trips/application/use-cases/start-trip.use-case';
import type { TripRecord, TripsRepository } from '../../../src/modules/trips/application/ports/trips.repository';

function createTripsRepositoryMock(): jest.Mocked<TripsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findVehicleByIdForMembership: jest.fn(),
    createTrip: jest.fn(),
    findTripById: jest.fn(),
    listTrips: jest.fn(),
    findOverlappingTrips: jest.fn(),
    updateTripStatus: jest.fn(),
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
    departureAt: new Date('2030-01-01T10:00:00.000Z'),
    estimatedArrivalAt: new Date('2030-01-01T10:30:00.000Z'),
    seatCount: 4,
    availableSeats: 2,
    vehicleTypeSnapshot: VehicleType.Car,
    luggagePolicySnapshot: LuggagePolicy.UpToMedium,
    basePriceReference: 2.5,
    detourSurchargeReference: null,
    notes: null,
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    ...overrides,
  };
}

describe('Trip status transition use cases', () => {
  it('rejects publishing a trip when overlapping trips already exist', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new PublishTripUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip(TripStatus.Draft));
    repository.findOverlappingTrips.mockResolvedValue([
      buildTrip(TripStatus.Published, { id: 'trip-overlap' }),
    ]);

    await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
      new BadRequestException(
        'No puedes publicar viajes con horarios solapados para el mismo conductor.',
      ),
    );

    expect(repository.updateTripStatus).not.toHaveBeenCalled();
  });

  it('publishes a trip without seats as FULL and records audit', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new PublishTripUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(
      buildTrip(TripStatus.Draft, { availableSeats: 0 }),
    );
    repository.findOverlappingTrips.mockResolvedValue([]);
    repository.updateTripStatus.mockResolvedValue(buildTrip(TripStatus.Full, { availableSeats: 0 }));

    const response = await useCase.execute('user-1', 'trip-1');

    expect(response.message).toBe('Viaje publicado correctamente.');
    expect(repository.updateTripStatus).toHaveBeenCalledWith('trip-1', TripStatus.Full);
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.TripPublished,
      entityType: AuditEntityType.Trip,
      entityId: 'trip-1',
      metadata: {
        status: TripStatus.Full,
      },
    });
  });

  it('starts a published trip and records audit', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new StartTripUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip(TripStatus.Published));
    repository.updateTripStatus.mockResolvedValue(buildTrip(TripStatus.InProgress));

    const response = await useCase.execute('user-1', 'trip-1');

    expect(response.message).toBe('Viaje iniciado correctamente.');
    expect(repository.updateTripStatus).toHaveBeenCalledWith('trip-1', TripStatus.InProgress);
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.TripStarted,
      entityType: AuditEntityType.Trip,
      entityId: 'trip-1',
      metadata: {
        status: TripStatus.InProgress,
      },
    });
  });

  it('completes an in-progress trip and records audit', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new CompleteTripUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip(TripStatus.InProgress));
    repository.updateTripStatus.mockResolvedValue(buildTrip(TripStatus.Completed));

    const response = await useCase.execute('user-1', 'trip-1');

    expect(response.message).toBe('Viaje finalizado correctamente.');
    expect(repository.updateTripStatus).toHaveBeenCalledWith('trip-1', TripStatus.Completed);
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.TripCompleted,
      entityType: AuditEntityType.Trip,
      entityId: 'trip-1',
      metadata: {
        status: TripStatus.Completed,
      },
    });
  });
});
