import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  MembershipStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

import { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';
import { CreateTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/create-trip-request.use-case';
import type { TripRequestsRepository } from '../../../src/modules/trip-requests/application/ports/trip-requests.repository';

function createTripRequestsRepositoryMock(): jest.Mocked<TripRequestsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findTripById: jest.fn(),
    findTripRequestById: jest.fn(),
    findActiveRequestForTripAndPassenger: jest.fn(),
    createTripRequest: jest.fn(),
    listTripRequestsByPassengerMembershipId: jest.fn(),
    listTripRequestsByDriverMembershipId: jest.fn(),
    acceptTripRequest: jest.fn(),
    rejectTripRequest: jest.fn(),
    cancelTripRequest: jest.fn(),
    markTripRequestAsNoShow: jest.fn(),
  };
}

function createOperationalSanctionsServiceMock(): jest.Mocked<OperationalSanctionsService> {
  return {
    synchronizeAutomaticSanctions: jest.fn(),
    assertPassengerOperationsAllowed: jest.fn(),
    assertDriverOperationsAllowed: jest.fn(),
  } as unknown as jest.Mocked<OperationalSanctionsService>;
}

describe('CreateTripRequestUseCase', () => {
  it('rejects when the user tries to request a trip owned by the same driver', async () => {
    const repository = createTripRequestsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(repository, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      fullName: 'Usuario Uno',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
    });

    repository.findTripById.mockResolvedValue({
      id: 'trip-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-1',
      driverFullName: 'Usuario Uno',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Campus Huachi',
      destinationLabel: 'Centro',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:30:00.000Z'),
      seatCount: 4,
      availableSeats: 3,
    });

    await expect(
      useCase.execute({
        userId: 'user-1',
        tripId: 'trip-1',
      }),
    ).rejects.toThrow(new BadRequestException('No puedes solicitar un viaje propio.'));

    expect(repository.createTripRequest).not.toHaveBeenCalled();
  });

  it('rejects custom detour points for direct routes', async () => {
    const repository = createTripRequestsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(repository, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
    });

    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        requestedPickupLatitude: -1.23,
        requestedPickupLongitude: -78.61,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Las rutas directas no admiten puntos personalizados de recogida o destino.',
      ),
    );

    expect(repository.createTripRequest).not.toHaveBeenCalled();
  });

  it('blocks trip requests when the passenger has an active operational restriction', async () => {
    const repository = createTripRequestsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(repository, sanctionsService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
    });
    sanctionsService.assertPassengerOperationsAllowed.mockRejectedValue(
      new ForbiddenException(
        'Tu membresia tiene una restriccion temporal para operar como pasajero hasta 01/01/2030.',
      ),
    );

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'Tu membresia tiene una restriccion temporal para operar como pasajero hasta 01/01/2030.',
      ),
    );

    expect(repository.findTripById).not.toHaveBeenCalled();
  });
});
