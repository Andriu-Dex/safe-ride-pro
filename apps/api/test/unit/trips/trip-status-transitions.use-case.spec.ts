import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  CancellationTiming,
  DriverLicenseStatus,
  DriverVerificationStatus,
  LuggagePolicy,
  MembershipStatus,
  TripRequestStatus,
  TripLiveTrackingStatus,
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
import { DeleteDraftTripUseCase } from '../../../src/modules/trips/application/use-cases/delete-draft-trip.use-case';
import { PublishTripUseCase } from '../../../src/modules/trips/application/use-cases/publish-trip.use-case';
import { StartTripUseCase } from '../../../src/modules/trips/application/use-cases/start-trip.use-case';
import type { TripRecord, TripsRepository } from '../../../src/modules/trips/application/ports/trips.repository';

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
    findAcceptedPassengerMembershipIds: jest.fn(
      async (_tripId: string): Promise<string[]> => [],
    ),
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
    closureNote: null,
    cancelledAt: null,
    completedAt: null,
    cancellationTiming: null,
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    updatedAt: new Date('2030-01-01T09:00:00.000Z'),
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

  it('publishes a trip with available seats as PUBLISHED and records audit', async () => {
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
      buildTrip(TripStatus.Draft, { availableSeats: 2, seatCount: 4 }),
    );
    repository.findVehicleByIdForMembership.mockResolvedValue(buildVehicle());
    repository.findOverlappingTrips.mockResolvedValue([]);
    repository.updateTripStatus.mockResolvedValue(buildTrip(TripStatus.Published, { availableSeats: 2, seatCount: 4 }));

    const response = await useCase.execute('user-1', 'trip-1');

    expect(response.message).toBe('Viaje publicado correctamente.');
    expect(repository.updateTripStatus).toHaveBeenCalledWith('trip-1', TripStatus.Published);
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.TripPublished,
      entityType: AuditEntityType.Trip,
      entityId: 'trip-1',
      metadata: {
        status: TripStatus.Published,
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
    repository.activateTripLiveTracking.mockResolvedValue({
      tripId: 'trip-1',
      status: TripLiveTrackingStatus.Active,
      startedAt: new Date(),
      endedAt: null,
      lastSignalAt: null,
      currentLatitude: null,
      currentLongitude: null,
      currentAccuracyMeters: null,
      currentHeadingDegrees: null,
      currentSpeedKph: null,
      history: [],
    });

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
    repository.listTripExecutionPassengers.mockResolvedValue([]);
    repository.completeTrip.mockResolvedValue(
      buildTrip(TripStatus.Completed, {
        completedAt: new Date('2030-01-01T10:31:00.000Z'),
      }),
    );
    repository.endTripLiveTracking.mockResolvedValue({
      tripId: 'trip-1',
      status: TripLiveTrackingStatus.Ended,
      startedAt: new Date(),
      endedAt: new Date(),
      lastSignalAt: null,
      currentLatitude: null,
      currentLongitude: null,
      currentAccuracyMeters: null,
      currentHeadingDegrees: null,
      currentSpeedKph: null,
      history: [],
    });

    const response = await useCase.execute('user-1', 'trip-1');

    expect(response.message).toBe('Viaje finalizado correctamente.');
    expect(repository.completeTrip).toHaveBeenCalledWith({
      tripId: 'trip-1',
      completedAt: expect.any(Date),
      closureNote: null,
    });
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.TripCompleted,
      entityType: AuditEntityType.Trip,
      entityId: 'trip-1',
      metadata: {
        status: TripStatus.Completed,
        unresolvedPassengerCount: 0,
        forcedClosure: false,
        closureNote: null,
      },
    });
  });

  it('requires a closure note when accepted passengers remain unresolved', async () => {
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
    repository.listTripExecutionPassengers.mockResolvedValue([
      {
        requestId: 'request-1',
        passengerMembershipId: 'membership-passenger',
        passengerFullName: 'Pasajero Uno',
        status: TripRequestStatus.Accepted,
        executionStatus: null,
        boardedAt: null,
        droppedOffAt: null,
      },
    ]);

    await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
      new BadRequestException(
        'Antes de finalizar el viaje debes cerrar a todos los pasajeros o registrar una nota de cierre excepcional.',
      ),
    );

    expect(repository.completeTrip).not.toHaveBeenCalled();
  });

  it('allows exceptional closure when an unresolved passenger exists and the closure note is valid', async () => {
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
    repository.listTripExecutionPassengers.mockResolvedValue([
      {
        requestId: 'request-1',
        passengerMembershipId: 'membership-passenger',
        passengerFullName: 'Pasajero Uno',
        status: TripRequestStatus.Accepted,
        executionStatus: null,
        boardedAt: null,
        droppedOffAt: null,
      },
    ]);
    repository.completeTrip.mockResolvedValue(
      buildTrip(TripStatus.Completed, {
        completedAt: new Date('2030-01-01T10:31:00.000Z'),
        closureNote: 'Pasajero no localizado en el punto',
      }),
    );
    repository.endTripLiveTracking.mockResolvedValue({
      tripId: 'trip-1',
      status: TripLiveTrackingStatus.Ended,
      startedAt: new Date(),
      endedAt: new Date(),
      lastSignalAt: null,
      currentLatitude: null,
      currentLongitude: null,
      currentAccuracyMeters: null,
      currentHeadingDegrees: null,
      currentSpeedKph: null,
      history: [],
    });

    const response = await useCase.execute(
      'user-1',
      'trip-1',
      'Pasajero no localizado en el punto',
    );

    expect(response.message).toBe('Viaje finalizado con cierre operativo excepcional.');
    expect(repository.completeTrip).toHaveBeenCalledWith({
      tripId: 'trip-1',
      completedAt: expect.any(Date),
      closureNote: 'Pasajero no localizado en el punto',
    });
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.TripCompleted,
      entityType: AuditEntityType.Trip,
      entityId: 'trip-1',
      metadata: {
        status: TripStatus.Completed,
        unresolvedPassengerCount: 1,
        forcedClosure: true,
        closureNote: 'Pasajero no localizado en el punto',
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

  it('deletes an unpublished draft without recalculating operational sanctions', async () => {
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
    repository.findTripById.mockResolvedValue(buildTrip(TripStatus.Draft));
    repository.cancelTripAndActiveRequests.mockResolvedValue(
      buildTrip(TripStatus.Cancelled, {
        cancellationTiming: CancellationTiming.Late,
        cancelledAt: new Date('2030-01-01T09:40:00.000Z'),
      }),
    );

    const response = await useCase.execute('user-1', 'trip-1');

    expect(response.message).toBe('Viaje eliminado correctamente.');
    expect(repository.cancelTripAndActiveRequests).toHaveBeenCalledWith('trip-1');
    expect(sanctionsService.synchronizeAutomaticSanctions).not.toHaveBeenCalled();
  });

  it('physically deletes a draft trip before publication', async () => {
    const repository = createTripsRepositoryMock();
    const useCase = new DeleteDraftTripUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip(TripStatus.Draft));
    repository.countActiveRequestsForTrip.mockResolvedValue(0);

    const response = await useCase.execute('user-1', 'trip-1');

    expect(response.message).toBe('Viaje eliminado correctamente.');
    expect(repository.deleteDraftTrip).toHaveBeenCalledWith('trip-1');
    expect(repository.cancelTripAndActiveRequests).not.toHaveBeenCalled();
  });

  it('does not physically delete a trip after publication', async () => {
    const repository = createTripsRepositoryMock();
    const useCase = new DeleteDraftTripUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findTripById.mockResolvedValue(buildTrip(TripStatus.Published));

    await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
      'Solo se pueden eliminar viajes que aun no han sido publicados.',
    );
    expect(repository.deleteDraftTrip).not.toHaveBeenCalled();
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

  describe('validation edge cases and uncovered branches', () => {
    it('handles CancelTripUseCase validation edge cases', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const realtimeEventsService = { publishTripChanged: jest.fn(), publishTripLiveTrackingUpdated: jest.fn() } as any;
      const useCase = new CancelTripUseCase(repository, auditService, sanctionsService, { cancelTripPayments: jest.fn() } as any, realtimeEventsService);

      // 1. Membership inactive/missing
      repository.findDefaultMembershipByUserId.mockResolvedValueOnce(null);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('No tienes una membresia activa para cancelar viajes.'),
      );

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Inactive,
      } as any);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('No tienes una membresia activa para cancelar viajes.'),
      );

      // Setup active membership
      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
      } as any);

      // 2. Trip not found
      repository.findTripById.mockResolvedValueOnce(null);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new NotFoundException('El viaje solicitado no existe.'),
      );

      // 3. Different driver
      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Published, { driverMembershipId: 'membership-other' }));
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('Solo el conductor duenio puede cancelar este viaje.'),
      );

      // 4. InProgress/Completed status
      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.InProgress));
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new BadRequestException('No se puede cancelar un viaje que ya inicio o finalizo.'),
      );

      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Completed));
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new BadRequestException('No se puede cancelar un viaje que ya inicio o finalizo.'),
      );

      // 5. Already cancelled
      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Cancelled));
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new BadRequestException('El viaje ya se encuentra cancelado.'),
      );

      // 6. Tracking exists coverage (line 90)
      repository.findTripById.mockResolvedValue(buildTrip(TripStatus.Published));
      repository.cancelTripAndActiveRequests.mockResolvedValue(buildTrip(TripStatus.Cancelled));
      repository.endTripLiveTracking.mockResolvedValue({
        status: TripLiveTrackingStatus.Ended,
        lastSignalAt: new Date(),
        currentLatitude: -1.25,
        currentLongitude: -78.62,
        currentAccuracyMeters: 5,
        currentHeadingDegrees: 90,
        currentSpeedKph: 0,
      } as any);

      const res = await useCase.execute('user-1', 'trip-1');
      expect(res.message).toBe('Viaje cancelado correctamente.');
      expect(realtimeEventsService.publishTripLiveTrackingUpdated).toHaveBeenCalled();
    });

    it('handles CompleteTripUseCase validation edge cases', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const realtimeEventsService = { publishTripChanged: jest.fn(), publishTripLiveTrackingUpdated: jest.fn() } as any;
      const useCase = new CompleteTripUseCase(repository, auditService, realtimeEventsService);

      // 1. Membership inactive/missing
      repository.findDefaultMembershipByUserId.mockResolvedValueOnce(null);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('No tienes una membresia activa para finalizar viajes.'),
      );

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
      } as any);

      // 2. Trip not found
      repository.findTripById.mockResolvedValueOnce(null);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new NotFoundException('El viaje solicitado no existe.'),
      );

      // 3. Different driver
      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Published, { driverMembershipId: 'membership-other' }));
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('Solo el conductor duenio puede finalizar este viaje.'),
      );

      // 4. Not in progress status
      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Published));
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new BadRequestException('Solo los viajes en curso pueden finalizarse.'),
      );

      // 5. Tracking exists coverage (line 100)
      repository.findTripById.mockResolvedValue(buildTrip(TripStatus.InProgress));
      repository.listTripExecutionPassengers.mockResolvedValue([]);
      repository.completeTrip.mockResolvedValue(buildTrip(TripStatus.Completed));
      repository.endTripLiveTracking.mockResolvedValue({
        status: TripLiveTrackingStatus.Ended,
        lastSignalAt: new Date(),
        currentLatitude: -1.25,
        currentLongitude: -78.62,
        currentAccuracyMeters: 5,
        currentHeadingDegrees: 90,
        currentSpeedKph: 0,
      } as any);

      const res = await useCase.execute('user-1', 'trip-1');
      expect(res.message).toBe('Viaje finalizado correctamente.');
      expect(realtimeEventsService.publishTripLiveTrackingUpdated).toHaveBeenCalled();
    });

    it('handles DeleteDraftTripUseCase validation edge cases', async () => {
      const repository = createTripsRepositoryMock();
      const useCase = new DeleteDraftTripUseCase(repository);

      // 1. Membership inactive/missing
      repository.findDefaultMembershipByUserId.mockResolvedValueOnce(null);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('No tienes una membresia activa para eliminar viajes.'),
      );

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
      } as any);

      // 2. Trip not found
      repository.findTripById.mockResolvedValueOnce(null);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new NotFoundException('El viaje solicitado no existe.'),
      );

      // 3. Different driver
      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Draft, { driverMembershipId: 'membership-other' }));
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('Solo el conductor duenio puede eliminar este viaje.'),
      );

      // 4. Active requests > 0
      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Draft));
      repository.countActiveRequestsForTrip.mockResolvedValueOnce(1);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new BadRequestException('No se puede eliminar un viaje con solicitudes activas.'),
      );
    });

    it('handles PublishTripUseCase validation edge cases', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new PublishTripUseCase(repository, auditService, sanctionsService);

      // 1. Membership inactive/missing
      repository.findDefaultMembershipByUserId.mockResolvedValueOnce(null);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('No tienes una membresia activa para publicar viajes.'),
      );

      // 2. Driver not approved
      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.PendingVerification,
      } as any);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('Solo un conductor aprobado puede publicar viajes.'),
      );

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);

      // 3. Trip not found
      repository.findTripById.mockResolvedValueOnce(null);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new NotFoundException('El viaje solicitado no existe.'),
      );

      // 4. Different driver
      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Draft, { driverMembershipId: 'membership-other' }));
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('Solo el conductor duenio puede publicar este viaje.'),
      );

      // 5. Already published / not draft
      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Published));
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new BadRequestException('Solo los viajes en borrador pueden publicarse.'),
      );

      // 6. Available seats > seatCount
      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Draft, { availableSeats: 5, seatCount: 4 }));
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new BadRequestException('Los cupos disponibles no pueden superar la capacidad del viaje.'),
      );

      // 7. Arrival time <= departure time
      const departure = new Date(Date.now() + 10 * 60_000);
      const invalidArrival = new Date(departure.getTime() - 5 * 60_000);
      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Draft, { departureAt: departure, estimatedArrivalAt: invalidArrival }));
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new BadRequestException('La llegada estimada del viaje debe ser posterior a la salida.'),
      );
    });

    it('handles StartTripUseCase validation edge cases', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const lifecycleService = createTripLifecycleMaintenanceServiceMock();
      const useCase = new StartTripUseCase(repository, auditService, sanctionsService, lifecycleService);

      // 1. Membership inactive/missing
      repository.findDefaultMembershipByUserId.mockResolvedValueOnce(null);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('No tienes una membresia activa para iniciar viajes.'),
      );

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
      } as any);

      // 2. Trip not found
      repository.findTripById.mockResolvedValueOnce(null);
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new NotFoundException('El viaje solicitado no existe.'),
      );

      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Published));
      lifecycleService.reconcileTripLifecycle.mockResolvedValueOnce(buildTrip(TripStatus.Published, { driverMembershipId: 'membership-other' }));
      // 3. Different driver
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new ForbiddenException('Solo el conductor duenio puede iniciar este viaje.'),
      );

      repository.findTripById.mockResolvedValueOnce(buildTrip(TripStatus.Published));
      lifecycleService.reconcileTripLifecycle.mockResolvedValueOnce(buildTrip(TripStatus.Draft));
      // 4. Status not published/full
      await expect(useCase.execute('user-1', 'trip-1')).rejects.toThrow(
        new BadRequestException('Solo los viajes publicados pueden iniciarse.'),
      );
    });
  });
});
