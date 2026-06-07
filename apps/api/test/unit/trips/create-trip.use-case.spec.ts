import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
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
import { CreateTripUseCase } from '../../../src/modules/trips/application/use-cases/create-trip.use-case';
import type {
  CreateTripInput,
  TripRecord,
  TripsRepository,
} from '../../../src/modules/trips/application/ports/trips.repository';

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

function buildCreatedTrip(input: CreateTripInput): TripRecord {
  return {
    id: 'trip-1',
    institutionId: input.institutionId,
    institutionName: 'UTA',
    driverMembershipId: input.driverMembershipId,
    driverFullName: 'Conductor Uno',
    vehicleId: input.vehicleId,
    vehiclePlate: 'ABC-123',
    vehicleDisplayName: 'Toyota Yaris',
    status: TripStatus.Draft,
    routeMode: input.routeMode,
    originLabel: input.originLabel,
    destinationLabel: input.destinationLabel,
    originLatitude: input.originLatitude,
    originLongitude: input.originLongitude,
    destinationLatitude: input.destinationLatitude,
    destinationLongitude: input.destinationLongitude,
    departureAt: input.departureAt,
    estimatedArrivalAt: input.estimatedArrivalAt,
    seatCount: input.seatCount,
    availableSeats: input.availableSeats,
    vehicleTypeSnapshot: input.vehicleTypeSnapshot,
    luggagePolicySnapshot: input.luggagePolicySnapshot,
    basePriceReference: input.basePriceReference,
    detourSurchargeReference: input.detourSurchargeReference ?? null,
    notes: input.notes ?? null,
    closureNote: null,
    cancelledAt: null,
    completedAt: null,
    cancellationTiming: null,
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    updatedAt: new Date('2030-01-01T09:00:00.000Z'),
  };
}

describe('CreateTripUseCase', () => {
  it('rejects users who are not approved drivers', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.PendingVerification,
    });

    await expect(
      useCase.execute({
        userId: 'user-1',
        vehicleId: 'vehicle-1',
        routeMode: TripRouteMode.DirectRoute,
        originLabel: 'Huachi',
        destinationLabel: 'Centro',
        originLatitude: -1.25,
        originLongitude: -78.62,
        destinationLatitude: -1.24,
        destinationLongitude: -78.61,
        departureAt: '2030-01-01T10:00:00.000Z',
        estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
        seatCount: 3,
        basePriceReference: 2.5,
      }),
    ).rejects.toThrow(
      new ForbiddenException('Solo un conductor aprobado puede crear viajes.'),
    );
  });

  it('rejects direct routes with detour surcharge', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findVehicleByIdForMembership.mockResolvedValue({
      id: 'vehicle-1',
      membershipId: 'membership-1',
      isActive: true,
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      vehicleType: VehicleType.Car,
      plate: 'ABC-123',
      displayName: 'Toyota Yaris',
    });

    await expect(
      useCase.execute({
        userId: 'user-1',
        vehicleId: 'vehicle-1',
        routeMode: TripRouteMode.DirectRoute,
        originLabel: 'Huachi',
        destinationLabel: 'Centro',
        originLatitude: -1.25,
        originLongitude: -78.62,
        destinationLatitude: -1.24,
        destinationLongitude: -78.61,
        departureAt: '2030-01-01T10:00:00.000Z',
        estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
        seatCount: 3,
        basePriceReference: 2.5,
        detourSurchargeReference: 0.5,
      }),
    ).rejects.toThrow(
      new BadRequestException('La ruta directa no admite recargo por desvio.'),
    );
  });

  it('rejects trips with equal labels or coordinates for origin and destination', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findVehicleByIdForMembership.mockResolvedValue({
      id: 'vehicle-1',
      membershipId: 'membership-1',
      isActive: true,
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      vehicleType: VehicleType.Car,
      plate: 'ABC-123',
      displayName: 'Toyota Yaris',
    });

    await expect(
      useCase.execute({
        userId: 'user-1',
        vehicleId: 'vehicle-1',
        routeMode: TripRouteMode.DirectRoute,
        originLabel: '  Campus  ',
        destinationLabel: 'campus',
        originLatitude: -1.25,
        originLongitude: -78.62,
        destinationLatitude: -1.25,
        destinationLongitude: -78.62,
        departureAt: '2030-01-01T10:00:00.000Z',
        estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
        seatCount: 3,
        basePriceReference: 2.5,
      }),
    ).rejects.toThrow(
      new BadRequestException('El origen y el destino no pueden ser iguales.'),
    );
  });

  it('creates a trip draft using vehicle snapshots and records audit', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.findVehicleByIdForMembership.mockResolvedValue({
      id: 'vehicle-1',
      membershipId: 'membership-1',
      isActive: true,
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UpToMedium,
      vehicleType: VehicleType.Car,
      plate: 'ABC-123',
      displayName: 'Toyota Yaris',
    });
    repository.createTrip.mockImplementation(async (input) => buildCreatedTrip(input));

    const response = await useCase.execute({
      userId: 'user-1',
      vehicleId: 'vehicle-1',
      routeMode: TripRouteMode.PlannedDetour,
      originLabel: '  Huachi  ',
      destinationLabel: '  Centro  ',
      originLatitude: -1.25,
      originLongitude: -78.62,
      destinationLatitude: -1.24,
      destinationLongitude: -78.61,
      departureAt: '2030-01-01T10:00:00.000Z',
      estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
      seatCount: 3,
      basePriceReference: 2.5,
      detourSurchargeReference: 0.75,
      notes: '  Llevar carnet estudiantil  ',
    });

    expect(response.message).toBe('Viaje creado en borrador correctamente.');
    expect(repository.createTrip).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      driverMembershipId: 'membership-1',
      vehicleId: 'vehicle-1',
      routeMode: TripRouteMode.PlannedDetour,
      originLabel: 'Huachi',
      destinationLabel: 'Centro',
      originLatitude: -1.25,
      originLongitude: -78.62,
      destinationLatitude: -1.24,
      destinationLongitude: -78.61,
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:30:00.000Z'),
      seatCount: 3,
      availableSeats: 3,
      vehicleTypeSnapshot: VehicleType.Car,
      luggagePolicySnapshot: LuggagePolicy.UpToMedium,
      basePriceReference: 2.5,
      detourSurchargeReference: 0.75,
      notes: 'Llevar carnet estudiantil',
    });
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.TripCreated,
      entityType: AuditEntityType.Trip,
      entityId: 'trip-1',
      metadata: {
        routeMode: TripRouteMode.PlannedDetour,
        departureAt: '2030-01-01T10:00:00.000Z',
      },
    });
    expect(sanctionsService.assertDriverOperationsAllowed).toHaveBeenCalledWith('membership-1');
  });

  it('blocks creating a trip when the approved driver license is expired', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

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

    await expect(
      useCase.execute({
        userId: 'user-1',
        vehicleId: 'vehicle-1',
        routeMode: TripRouteMode.DirectRoute,
        originLabel: 'Huachi',
        destinationLabel: 'Centro',
        originLatitude: -1.25,
        originLongitude: -78.62,
        destinationLatitude: -1.24,
        destinationLongitude: -78.61,
        departureAt: '2030-01-01T10:00:00.000Z',
        estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
        seatCount: 3,
        basePriceReference: 2.5,
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'Tu licencia vencio. Debes actualizarla antes de crear nuevos viajes.',
      ),
    );
  });

  it('blocks creating a trip when the operational sanctions restrict the driver role', async () => {
    const repository = createTripsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

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

    await expect(
      useCase.execute({
        userId: 'user-1',
        vehicleId: 'vehicle-1',
        routeMode: TripRouteMode.DirectRoute,
        originLabel: 'Huachi',
        destinationLabel: 'Centro',
        originLatitude: -1.25,
        originLongitude: -78.62,
        destinationLatitude: -1.24,
        destinationLongitude: -78.61,
        departureAt: '2030-01-01T10:00:00.000Z',
        estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
        seatCount: 3,
        basePriceReference: 2.5,
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'Tu membresia tiene una restriccion temporal para operar como conductor hasta 01/01/2030.',
      ),
    );

    expect(repository.findVehicleByIdForMembership).not.toHaveBeenCalled();
  });

  describe('validation edge cases and uncovered branches', () => {
    it('handles inactive membership', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

      repository.findDefaultMembershipByUserId.mockResolvedValueOnce(null);
      await expect(
        useCase.execute({
          userId: 'user-1',
          vehicleId: 'vehicle-1',
          routeMode: TripRouteMode.DirectRoute,
          originLabel: 'Huachi',
          destinationLabel: 'Centro',
          originLatitude: -1.25,
          originLongitude: -78.62,
          destinationLatitude: -1.24,
          destinationLongitude: -78.61,
          departureAt: '2030-01-01T10:00:00.000Z',
          estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
          seatCount: 3,
          basePriceReference: 2.5,
        }),
      ).rejects.toThrow(new ForbiddenException('No tienes una membresia activa para crear viajes.'));
    });

    it('handles inactive or missing vehicle', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);

      repository.findVehicleByIdForMembership.mockResolvedValueOnce(null);
      await expect(
        useCase.execute({
          userId: 'user-1',
          vehicleId: 'vehicle-1',
          routeMode: TripRouteMode.DirectRoute,
          originLabel: 'Huachi',
          destinationLabel: 'Centro',
          originLatitude: -1.25,
          originLongitude: -78.62,
          destinationLatitude: -1.24,
          destinationLongitude: -78.61,
          departureAt: '2030-01-01T10:00:00.000Z',
          estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
          seatCount: 3,
          basePriceReference: 2.5,
        }),
      ).rejects.toThrow(new BadRequestException('El vehiculo seleccionado no existe o no se encuentra activo.'));
    });

    it('handles seat count limits', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);
      repository.findVehicleByIdForMembership.mockResolvedValue({
        id: 'vehicle-1',
        isActive: true,
        seatCount: 4,
      } as any);

      await expect(
        useCase.execute({
          userId: 'user-1',
          vehicleId: 'vehicle-1',
          routeMode: TripRouteMode.DirectRoute,
          originLabel: 'Huachi',
          destinationLabel: 'Centro',
          originLatitude: -1.25,
          originLongitude: -78.62,
          destinationLatitude: -1.24,
          destinationLongitude: -78.61,
          departureAt: '2030-01-01T10:00:00.000Z',
          estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
          seatCount: 0,
          basePriceReference: 2.5,
        }),
      ).rejects.toThrow(new BadRequestException('La cantidad de cupos no puede superar la capacidad del vehiculo.'));

      await expect(
        useCase.execute({
          userId: 'user-1',
          vehicleId: 'vehicle-1',
          routeMode: TripRouteMode.DirectRoute,
          originLabel: 'Huachi',
          destinationLabel: 'Centro',
          originLatitude: -1.25,
          originLongitude: -78.62,
          destinationLatitude: -1.24,
          destinationLongitude: -78.61,
          departureAt: '2030-01-01T10:00:00.000Z',
          estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
          seatCount: 5,
          basePriceReference: 2.5,
        }),
      ).rejects.toThrow(new BadRequestException('La cantidad de cupos no puede superar la capacidad del vehiculo.'));
    });

    it('handles missing origin/destination labels', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);
      repository.findVehicleByIdForMembership.mockResolvedValue({
        id: 'vehicle-1',
        isActive: true,
        seatCount: 4,
      } as any);

      await expect(
        useCase.execute({
          userId: 'user-1',
          vehicleId: 'vehicle-1',
          routeMode: TripRouteMode.DirectRoute,
          originLabel: '   ',
          destinationLabel: 'Centro',
          originLatitude: -1.25,
          originLongitude: -78.62,
          destinationLatitude: -1.24,
          destinationLongitude: -78.61,
          departureAt: '2030-01-01T10:00:00.000Z',
          estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
          seatCount: 3,
          basePriceReference: 2.5,
        }),
      ).rejects.toThrow(new BadRequestException('Debes indicar origen y destino del viaje.'));
    });

    it('handles same coordinates for origin and destination', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);
      repository.findVehicleByIdForMembership.mockResolvedValue({
        id: 'vehicle-1',
        isActive: true,
        seatCount: 4,
      } as any);

      await expect(
        useCase.execute({
          userId: 'user-1',
          vehicleId: 'vehicle-1',
          routeMode: TripRouteMode.DirectRoute,
          originLabel: 'Huachi',
          destinationLabel: 'Centro',
          originLatitude: -1.25,
          originLongitude: -78.62,
          destinationLatitude: -1.25,
          destinationLongitude: -78.62,
          departureAt: '2030-01-01T10:00:00.000Z',
          estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
          seatCount: 3,
          basePriceReference: 2.5,
        }),
      ).rejects.toThrow(new BadRequestException('El origen y el destino no pueden compartir las mismas coordenadas.'));
    });

    it('handles invalid dates', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);
      repository.findVehicleByIdForMembership.mockResolvedValue({
        id: 'vehicle-1',
        isActive: true,
        seatCount: 4,
      } as any);

      await expect(
        useCase.execute({
          userId: 'user-1',
          vehicleId: 'vehicle-1',
          routeMode: TripRouteMode.DirectRoute,
          originLabel: 'Huachi',
          destinationLabel: 'Centro',
          originLatitude: -1.25,
          originLongitude: -78.62,
          destinationLatitude: -1.24,
          destinationLongitude: -78.61,
          departureAt: 'invalid-date',
          estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
          seatCount: 3,
          basePriceReference: 2.5,
        }),
      ).rejects.toThrow(new BadRequestException('Las fechas del viaje no son validas.'));
    });

    it('handles departure time not in future', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);
      repository.findVehicleByIdForMembership.mockResolvedValue({
        id: 'vehicle-1',
        isActive: true,
        seatCount: 4,
      } as any);

      await expect(
        useCase.execute({
          userId: 'user-1',
          vehicleId: 'vehicle-1',
          routeMode: TripRouteMode.DirectRoute,
          originLabel: 'Huachi',
          destinationLabel: 'Centro',
          originLatitude: -1.25,
          originLongitude: -78.62,
          destinationLatitude: -1.24,
          destinationLongitude: -78.61,
          departureAt: '2020-01-01T10:00:00.000Z',
          estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
          seatCount: 3,
          basePriceReference: 2.5,
        }),
      ).rejects.toThrow(new BadRequestException('La salida del viaje debe estar en el futuro.'));
    });

    it('handles arrival time <= departure time', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new CreateTripUseCase(repository, auditService, sanctionsService);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);
      repository.findVehicleByIdForMembership.mockResolvedValue({
        id: 'vehicle-1',
        isActive: true,
        seatCount: 4,
      } as any);

      await expect(
        useCase.execute({
          userId: 'user-1',
          vehicleId: 'vehicle-1',
          routeMode: TripRouteMode.DirectRoute,
          originLabel: 'Huachi',
          destinationLabel: 'Centro',
          originLatitude: -1.25,
          originLongitude: -78.62,
          destinationLatitude: -1.24,
          destinationLongitude: -78.61,
          departureAt: '2030-01-01T10:00:00.000Z',
          estimatedArrivalAt: '2030-01-01T09:30:00.000Z',
          seatCount: 3,
          basePriceReference: 2.5,
        }),
      ).rejects.toThrow(new BadRequestException('La llegada estimada debe ser posterior a la salida.'));
    });

    it('handles route path normalization with valid and invalid coordinates', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const realtimeEventsService = { publishTripChanged: jest.fn() } as any;
      const useCase = new CreateTripUseCase(repository, auditService, sanctionsService, realtimeEventsService);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        institutionId: 'institution-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);
      repository.findVehicleByIdForMembership.mockResolvedValue({
        id: 'vehicle-1',
        isActive: true,
        seatCount: 4,
        vehicleType: VehicleType.Car,
        luggagePolicy: LuggagePolicy.UpToMedium,
      } as any);
      repository.createTrip.mockImplementation(async (input) => buildCreatedTrip(input));

      await useCase.execute({
        userId: 'user-1',
        vehicleId: 'vehicle-1',
        routeMode: TripRouteMode.DirectRoute,
        originLabel: 'Huachi',
        destinationLabel: 'Centro',
        originLatitude: -1.25,
        originLongitude: -78.62,
        destinationLatitude: -1.24,
        destinationLongitude: -78.61,
        departureAt: '2030-01-01T10:00:00.000Z',
        estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
        seatCount: 3,
        basePriceReference: 2.5,
        routePath: [
          { latitude: -1.245, longitude: -78.615 }, // valid
          { latitude: NaN, longitude: -78.615 }, // invalid
          { latitude: -1.245, longitude: Infinity }, // invalid
          { latitude: -95, longitude: -78 }, // invalid latitude
        ],
      });

      expect(repository.createTrip).toHaveBeenCalledWith(
        expect.objectContaining({
          routePath: [{ latitude: -1.245, longitude: -78.615 }],
        }),
      );
    });
  });
});
