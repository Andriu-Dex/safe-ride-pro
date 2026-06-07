import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  DriverLicenseStatus,
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

  describe('validation edge cases and uncovered branches', () => {
    it('handles membership validations', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new UpdateTripUseCase(repository, auditService, sanctionsService);

      // 1. Missing membership
      repository.findDefaultMembershipByUserId.mockResolvedValueOnce(null);
      await expect(useCase.execute(buildCommand())).rejects.toThrow(
        new ForbiddenException('No tienes una membresia activa para editar viajes.'),
      );

      // 2. Inactive membership
      repository.findDefaultMembershipByUserId.mockResolvedValueOnce({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Inactive,
      } as any);
      await expect(useCase.execute(buildCommand())).rejects.toThrow(
        new ForbiddenException('No tienes una membresia activa para editar viajes.'),
      );

      // Setup active membership
      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.PendingVerification,
      } as any);

      // 3. Driver not approved
      await expect(useCase.execute(buildCommand())).rejects.toThrow(
        new ForbiddenException('Solo un conductor aprobado puede editar viajes.'),
      );

      // Approved driver but license expired
      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
        licenseStatus: DriverLicenseStatus.Expired,
      } as any);

      // 4. License expired
      await expect(useCase.execute(buildCommand())).rejects.toThrow(
        new ForbiddenException('Tu licencia vencio. Debes actualizarla antes de editar viajes.'),
      );
    });

    it('handles trip ownership and status validations', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new UpdateTripUseCase(repository, auditService, sanctionsService);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);

      // 1. Trip not found
      repository.findTripById.mockResolvedValueOnce(null);
      await expect(useCase.execute(buildCommand())).rejects.toThrow(
        new NotFoundException('El viaje solicitado no existe.'),
      );

      // 2. Different driver owner
      repository.findTripById.mockResolvedValueOnce(buildTrip({ driverMembershipId: 'membership-other' }));
      await expect(useCase.execute(buildCommand())).rejects.toThrow(
        new ForbiddenException('Solo el conductor duenio puede editar este viaje.'),
      );

      // Setup matching driver
      repository.findTripById.mockResolvedValue(buildTrip({ driverMembershipId: 'membership-1' }));

      // 3. Status InProgress/Completed/Cancelled
      repository.findTripById.mockResolvedValueOnce(buildTrip({ driverMembershipId: 'membership-1', status: TripStatus.InProgress }));
      await expect(useCase.execute(buildCommand())).rejects.toThrow(
        new BadRequestException('Solo puedes editar viajes que aun no hayan iniciado ni sido cerrados.'),
      );

      repository.findTripById.mockResolvedValueOnce(buildTrip({ driverMembershipId: 'membership-1', status: TripStatus.Completed }));
      await expect(useCase.execute(buildCommand())).rejects.toThrow(
        new BadRequestException('Solo puedes editar viajes que aun no hayan iniciado ni sido cerrados.'),
      );

      repository.findTripById.mockResolvedValueOnce(buildTrip({ driverMembershipId: 'membership-1', status: TripStatus.Cancelled }));
      await expect(useCase.execute(buildCommand())).rejects.toThrow(
        new BadRequestException('Solo puedes editar viajes que aun no hayan iniciado ni sido cerrados.'),
      );
    });

    it('handles vehicle and route details validation', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      const useCase = new UpdateTripUseCase(repository, auditService, sanctionsService);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);
      repository.findTripById.mockResolvedValue(buildTrip({ driverMembershipId: 'membership-1', status: TripStatus.Draft }));

      // 1. Missing or inactive vehicle
      repository.findVehicleByIdForMembership.mockResolvedValueOnce(null);
      await expect(useCase.execute(buildCommand())).rejects.toThrow(
        new BadRequestException('El vehiculo seleccionado no existe o no se encuentra activo.'),
      );

      repository.findVehicleByIdForMembership.mockResolvedValue({
        id: 'vehicle-1',
        isActive: true,
        seatCount: 4,
      } as any);

      // 2. Seat Count limit
      await expect(useCase.execute({ ...buildCommand(), seatCount: 0 })).rejects.toThrow(
        new BadRequestException('La cantidad de cupos no puede superar la capacidad del vehiculo.'),
      );
      await expect(useCase.execute({ ...buildCommand(), seatCount: 5 })).rejects.toThrow(
        new BadRequestException('La cantidad de cupos no puede superar la capacidad del vehiculo.'),
      );

      // 3. Missing labels
      await expect(useCase.execute({ ...buildCommand(), originLabel: '   ' })).rejects.toThrow(
        new BadRequestException('Debes indicar origen y destino del viaje.'),
      );

      // 3b. Same labels
      await expect(useCase.execute({ ...buildCommand(), originLabel: 'Huachi', destinationLabel: 'huachi' })).rejects.toThrow(
        new BadRequestException('El origen y el destino no pueden ser iguales.'),
      );

      // 4. Same coordinates
      await expect(
        useCase.execute({
          ...buildCommand(),
          originLatitude: -1.25,
          originLongitude: -78.62,
          destinationLatitude: -1.25,
          destinationLongitude: -78.62,
        }),
      ).rejects.toThrow(new BadRequestException('El origen y el destino no pueden compartir las mismas coordenadas.'));

      // 5. Invalid dates
      await expect(useCase.execute({ ...buildCommand(), departureAt: 'invalid-date' })).rejects.toThrow(
        new BadRequestException('Las fechas del viaje no son validas.'));

      // 6. Non-draft departure time in past
      repository.findTripById.mockResolvedValueOnce(buildTrip({ driverMembershipId: 'membership-1', status: TripStatus.Published }));
      await expect(
        useCase.execute({
          ...buildCommand(),
          departureAt: '2020-01-01T10:00:00.000Z',
        }),
      ).rejects.toThrow(new BadRequestException('La salida del viaje debe mantenerse en el futuro.'));

      repository.findTripById.mockResolvedValue(buildTrip({ driverMembershipId: 'membership-1', status: TripStatus.Draft }));

      // 7. Arrival time <= departure time
      await expect(
        useCase.execute({
          ...buildCommand(),
          departureAt: '2030-01-01T11:00:00.000Z',
          estimatedArrivalAt: '2030-01-01T10:30:00.000Z',
        }),
      ).rejects.toThrow(new BadRequestException('La llegada estimada debe ser posterior a la salida.'));

      // 7b. Direct route with detour surcharge
      await expect(useCase.execute({ ...buildCommand(), routeMode: TripRouteMode.DirectRoute, detourSurchargeReference: 0.5 })).rejects.toThrow(
        new BadRequestException('La ruta directa no admite recargo por desvio.'),
      );

      // 8. Overlapping trips
      repository.findOverlappingTrips.mockResolvedValueOnce([buildTrip({ id: 'trip-overlap' })]);
      await expect(useCase.execute(buildCommand())).rejects.toThrow(
        new BadRequestException(
          'No puedes guardar un viaje con horario solapado respecto a otro viaje activo del mismo conductor.',
        ),
      );
    });

    it('covers normalizeRoutePath filtering and default constructor', async () => {
      const repository = createTripsRepositoryMock();
      const auditService = { record: jest.fn() } as any;
      const sanctionsService = createOperationalSanctionsServiceMock();
      // Test default realtimeEventsService instantiation
      const useCase = new UpdateTripUseCase(repository, auditService, sanctionsService);

      repository.findDefaultMembershipByUserId.mockResolvedValue({
        id: 'membership-1',
        institutionId: 'institution-1',
        membershipStatus: MembershipStatus.Active,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      } as any);
      repository.findTripById.mockResolvedValue(buildTrip({ driverMembershipId: 'membership-1', status: TripStatus.Published }));
      repository.countActiveRequestsForTrip.mockResolvedValue(0);
      repository.findVehicleByIdForMembership.mockResolvedValue({
        id: 'vehicle-1',
        isActive: true,
        seatCount: 4,
        vehicleType: VehicleType.Car,
        luggagePolicy: LuggagePolicy.UpToMedium,
      } as any);
      repository.findOverlappingTrips.mockResolvedValue([]);
      repository.updateTrip.mockImplementation(async (input) => buildTrip(input as any));

      const res = await useCase.execute({
        ...buildCommand(),
        routePath: [
          { latitude: -1.25, longitude: -78.6 }, // valid
          { latitude: NaN, longitude: -78.6 }, // invalid
          { latitude: -95, longitude: -78.6 }, // invalid latitude
        ],
      });

      expect(repository.updateTrip).toHaveBeenCalledWith(
        expect.objectContaining({
          routePath: [{ latitude: -1.25, longitude: -78.6 }],
        }),
      );
      expect(res.message).toBe('Viaje actualizado correctamente.');
    });
  });
});
