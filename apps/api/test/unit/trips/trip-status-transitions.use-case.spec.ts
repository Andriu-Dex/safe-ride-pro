import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  CancellationTiming,
  DriverLicenseStatus,
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';
import { TripLifecycleMaintenanceService } from '../../../src/modules/trips/application/services/trip-lifecycle-maintenance.service';
import { CancelTripUseCase } from '../../../src/modules/trips/application/use-cases/cancel-trip.use-case';
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
    hasAcceptedTripRequest: jest.fn(),
    findLatestReusableTripByDriverMembershipId: jest.fn(),
    listTrips: jest.fn(),
    findOverlappingTrips: jest.fn(),
    updateTripStatus: jest.fn(),
    autoCancelTripForDriverAbsence: jest.fn(),
    cancelTripAndActiveRequests: jest.fn(),
    startTripAndClosePendingRequests: jest.fn(),
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

function createTripLifecycleMaintenanceServiceMock(): jest.Mocked<TripLifecycleMaintenanceService> {
  return {
    reconcileTripLifecycle: jest.fn(async (trip) => trip),
    reconcileTripCollection: jest.fn(async (trips) => trips),
    filterTripsByStatuses: jest.fn((trips) => trips),
  } as unknown as jest.Mocked<TripLifecycleMaintenanceService>;
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
    cancelledAt: null,
    cancellationTiming: null,
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    ...overrides,
  };
}

function buildVehicle(isActive = true) {
  return {
    id: 'vehicle-1',
    membershipId: 'membership-1',
    isActive,
    seatCount: 4,
    luggagePolicy: LuggagePolicy.UpToMedium,
    vehicleType: VehicleType.Car,
    plate: 'ABC-123',
    displayName: 'Toyota Yaris',
  };
}

describe('Trip status transition use cases', () => {
  it('rejects publishing a trip when overlapping trips already exist', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new PublishTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip(TripStatus.Draft));
    repository.findVehicleByIdForMembership.mockResolvedValue(buildVehicle());
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
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new PublishTripUseCase(repository, auditService, sanctionsService);

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
    repository.findVehicleByIdForMembership.mockResolvedValue(buildVehicle());
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
    expect(sanctionsService.assertDriverOperationsAllowed).toHaveBeenCalledWith('membership-1');
  });

  it('rejects publishing a trip when the vehicle is inactive or the departure time already passed', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new PublishTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(
      buildTrip(TripStatus.Draft, {
        departureAt: new Date('2020-01-01T10:00:00.000Z'),
      }),
    );

    await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
      new BadRequestException('No puedes publicar un viaje cuya salida ya vencio.'),
    );

    repository.findTripById.mockResolvedValue(buildTrip(TripStatus.Draft));
    repository.findVehicleByIdForMembership.mockResolvedValue(buildVehicle(false));

    await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
      new BadRequestException('No puedes publicar un viaje con un vehiculo inactivo.'),
    );
  });

  it('blocks publishing a trip when the approved driver license is expired', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new PublishTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
      licenseStatus: DriverLicenseStatus.Expired,
      licenseExpiresAt: new Date('2020-01-01T10:00:00.000Z'),
      licenseExpiresInDays: -1,
    });

    await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
      new ForbiddenException('Tu licencia vencio. Debes actualizarla antes de publicar viajes.'),
    );
  });

  it('starts a published trip and records audit', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const lifecycleService = createTripLifecycleMaintenanceServiceMock();
    const useCase = new StartTripUseCase(
      repository,
      auditService,
      sanctionsService,
      lifecycleService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(
      buildTrip(TripStatus.Published, {
        departureAt: new Date(Date.now() + 10 * 60_000),
        estimatedArrivalAt: new Date(Date.now() + 40 * 60_000),
      }),
    );
    repository.startTripAndClosePendingRequests.mockResolvedValue(buildTrip(TripStatus.InProgress));

    const response = await useCase.execute('user-1', 'trip-1');

    expect(response.message).toBe('Viaje iniciado correctamente.');
    expect(repository.startTripAndClosePendingRequests).toHaveBeenCalledWith(
      'trip-1',
      'Solicitud cerrada automaticamente porque el viaje ya inicio.',
    );
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
    expect(sanctionsService.assertDriverOperationsAllowed).toHaveBeenCalledWith('membership-1');
  });

  it('rejects starting a trip too early or after its estimated arrival time', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const lifecycleService = createTripLifecycleMaintenanceServiceMock();
    const useCase = new StartTripUseCase(
      repository,
      auditService,
      sanctionsService,
      lifecycleService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById
      .mockResolvedValueOnce(
        buildTrip(TripStatus.Published, {
          departureAt: new Date('2999-01-01T10:00:00.000Z'),
          estimatedArrivalAt: new Date('2999-01-01T10:30:00.000Z'),
        }),
      )
      .mockResolvedValueOnce(
        buildTrip(TripStatus.Published, {
          departureAt: new Date('2020-01-01T10:00:00.000Z'),
          estimatedArrivalAt: new Date('2020-01-01T10:30:00.000Z'),
        }),
      );

    await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
      new BadRequestException(
        'Solo puedes iniciar el viaje dentro de los 30 minutos previos a la salida programada.',
      ),
    );

    await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
      new BadRequestException('No puedes iniciar un viaje cuya llegada estimada ya vencio.'),
    );
  });

  it('rejects starting a trip when it was auto-cancelled by lifecycle reconciliation', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const lifecycleService = createTripLifecycleMaintenanceServiceMock();
    const useCase = new StartTripUseCase(
      repository,
      auditService,
      sanctionsService,
      lifecycleService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip(TripStatus.Published));
    lifecycleService.reconcileTripLifecycle.mockResolvedValue(
      buildTrip(TripStatus.Cancelled, {
        cancelledAt: new Date('2030-01-01T10:20:00.000Z'),
      }),
    );

    await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
      new BadRequestException(
        'Este viaje fue cancelado automaticamente porque la salida programada ya vencio sin que se iniciara a tiempo.',
      ),
    );

    expect(repository.startTripAndClosePendingRequests).not.toHaveBeenCalled();
  });

  it('blocks starting a trip when the approved driver license is expired', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const lifecycleService = createTripLifecycleMaintenanceServiceMock();
    const useCase = new StartTripUseCase(
      repository,
      auditService,
      sanctionsService,
      lifecycleService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
      licenseStatus: DriverLicenseStatus.Expired,
      licenseExpiresAt: new Date('2020-01-01T10:00:00.000Z'),
      licenseExpiresInDays: -1,
    });

    await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
      new ForbiddenException('Tu licencia vencio. Debes actualizarla antes de iniciar viajes.'),
    );
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

  it('cancels a trip and cascades active trip requests', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CancelTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip(TripStatus.Published));
    repository.cancelTripAndActiveRequests.mockResolvedValue(buildTrip(TripStatus.Cancelled));

    const response = await useCase.execute('user-1', 'trip-1');

    expect(response.message).toBe('Viaje cancelado correctamente.');
    expect(repository.cancelTripAndActiveRequests).toHaveBeenCalledWith('trip-1');
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.TripCancelled,
      entityType: AuditEntityType.Trip,
      entityId: 'trip-1',
      metadata: {
        status: TripStatus.Cancelled,
      },
    });
    expect(sanctionsService.synchronizeAutomaticSanctions).not.toHaveBeenCalled();
  });

  it('recalculates sanctions when a trip is cancelled late by the driver', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CancelTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip(TripStatus.Published));
    repository.cancelTripAndActiveRequests.mockResolvedValue(
      buildTrip(TripStatus.Cancelled, {
        cancellationTiming: CancellationTiming.Late,
        cancelledAt: new Date('2030-01-01T09:40:00.000Z'),
      }),
    );

    await useCase.execute('user-1', 'trip-1');

    expect(sanctionsService.synchronizeAutomaticSanctions).toHaveBeenCalledWith('membership-1');
  });

  it('blocks publishing or starting when the operational sanctions restrict the driver role', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const publishUseCase = new PublishTripUseCase(repository, auditService, sanctionsService);
    const lifecycleService = createTripLifecycleMaintenanceServiceMock();
    const startUseCase = new StartTripUseCase(
      repository,
      auditService,
      sanctionsService,
      lifecycleService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    sanctionsService.assertDriverOperationsAllowed.mockRejectedValue(
      new ForbiddenException(
        'Tu membresia tiene una restriccion temporal para operar como conductor hasta 01/01/2030.',
      ),
    );

    await expect(publishUseCase.execute('user-1', 'trip-1')).rejects.toThrow(
      new ForbiddenException(
        'Tu membresia tiene una restriccion temporal para operar como conductor hasta 01/01/2030.',
      ),
    );
    await expect(startUseCase.execute('user-1', 'trip-1')).rejects.toThrow(
      new ForbiddenException(
        'Tu membresia tiene una restriccion temporal para operar como conductor hasta 01/01/2030.',
      ),
    );
  });
});
