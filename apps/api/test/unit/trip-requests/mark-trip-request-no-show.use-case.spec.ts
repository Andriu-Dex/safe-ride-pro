import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

import { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';
import { MarkTripRequestNoShowUseCase } from '../../../src/modules/trip-requests/application/use-cases/mark-trip-request-no-show.use-case';
import type {
  TripRequestMembershipRecord,
  TripRequestRecord,
  TripRequestTripRecord,
  TripRequestsRepository,
} from '../../../src/modules/trip-requests/application/ports/trip-requests.repository';

function createTripRequestsRepositoryMock(): jest.Mocked<TripRequestsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn<Promise<TripRequestMembershipRecord | null>, [string]>(),
    findTripById: jest.fn<Promise<TripRequestTripRecord | null>, [string]>(),
    findTripRequestById: jest.fn<Promise<TripRequestRecord | null>, [string]>(),
    findActiveRequestForTripAndPassenger: jest.fn(),
    createTripRequest: jest.fn(),
    listTripRequestsByPassengerMembershipId: jest.fn(),
    listTripRequestsByDriverMembershipId: jest.fn(),
    acceptTripRequest: jest.fn(),
    rejectTripRequest: jest.fn(),
    cancelTripRequest: jest.fn(),
    markTripRequestAsNoShow: jest.fn(),
    markTripRequestBoarded: jest.fn(),
    markTripRequestDroppedOff: jest.fn(),
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

function buildTripRequestRecord(overrides: Partial<TripRequestRecord> = {}): TripRequestRecord {
  return {
    id: 'request-1',
    tripId: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    driverMembershipId: 'membership-driver',
    driverUserId: 'driver-1',
    driverFullName: 'Conductor Uno',
    passengerMembershipId: 'membership-passenger',
    passengerUserId: 'passenger-1',
    passengerFullName: 'Pasajero Uno',
    status: TripRequestStatus.Accepted,
    executionStatus: TripRequestExecutionStatus.AcceptedPendingBoarding,
    tripStatus: TripStatus.InProgress,
    tripRouteMode: TripRouteMode.DirectRoute,
    tripOriginLabel: 'Huachi',
    tripDestinationLabel: 'Centro',
    tripDepartureAt: new Date('2030-01-01T10:00:00.000Z'),
    tripEstimatedArrivalAt: new Date('2030-01-01T10:30:00.000Z'),
    tripCompletedAt: null,
    tripClosureNote: null,
    tripCancelledAt: null,
    tripSeatCount: 2,
    tripAvailableSeats: 1,
    requestedPickupLatitude: null,
    requestedPickupLongitude: null,
    requestedDropoffLatitude: null,
    requestedDropoffLongitude: null,
    requestMessage: null,
    reviewNote: null,
    executionStatusUpdatedAt: new Date('2030-01-01T09:40:00.000Z'),
    boardedAt: null,
    droppedOffAt: null,
    createdAt: new Date('2030-01-01T09:30:00.000Z'),
    reviewedAt: new Date('2030-01-01T09:40:00.000Z'),
    cancelledAt: null,
    cancellationTiming: null,
    payment: null,
    ...overrides,
  };
}

describe('MarkTripRequestNoShowUseCase', () => {
  it('registers a no-show when the driver owns the request and provides a note', async () => {
    const repository = createTripRequestsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new MarkTripRequestNoShowUseCase(repository, sanctionsService);

    repository.findTripRequestById.mockResolvedValue(buildTripRequestRecord());
    repository.markTripRequestAsNoShow.mockResolvedValue(
      buildTripRequestRecord({
        status: TripRequestStatus.NoShow,
        executionStatus: TripRequestExecutionStatus.NoShow,
        reviewNote: 'El pasajero no llego al punto acordado.',
      }),
    );

    const response = await useCase.execute(
      'driver-1',
      'request-1',
      'El pasajero no llego al punto acordado.',
    );

    expect(response.message).toBe('No-show registrado correctamente.');
    expect(repository.markTripRequestAsNoShow).toHaveBeenCalledWith(
      'request-1',
      'El pasajero no llego al punto acordado.',
    );
    expect(sanctionsService.synchronizeAutomaticSanctions).toHaveBeenCalledWith(
      'membership-passenger',
    );
  });

  it('rejects invalid no-show scenarios', async () => {
    const repository = createTripRequestsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new MarkTripRequestNoShowUseCase(repository, sanctionsService);

    repository.findTripRequestById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildTripRequestRecord({ driverUserId: 'driver-2' }))
      .mockResolvedValueOnce(buildTripRequestRecord({ status: TripRequestStatus.Pending }))
      .mockResolvedValueOnce(buildTripRequestRecord({ tripStatus: TripStatus.Published }))
      .mockResolvedValueOnce(
        buildTripRequestRecord({ executionStatus: TripRequestExecutionStatus.OnBoard }),
      )
      .mockResolvedValueOnce(buildTripRequestRecord());

    await expect(useCase.execute('driver-1', 'request-1', 'Nota')).rejects.toThrow(
      new NotFoundException('La solicitud de viaje no existe.'),
    );

    await expect(useCase.execute('driver-1', 'request-1', 'Nota')).rejects.toThrow(
      new ForbiddenException('Solo el conductor del viaje puede registrar un no-show.'),
    );

    await expect(useCase.execute('driver-1', 'request-1', 'Nota')).rejects.toThrow(
      new BadRequestException(
        'Solo las solicitudes aceptadas pueden marcarse como no-show.',
      ),
    );

    await expect(useCase.execute('driver-1', 'request-1', 'Nota')).rejects.toThrow(
      new BadRequestException(
        'Solo puedes marcar no-show cuando el viaje ya inicio o finalizo.',
      ),
    );

    await expect(useCase.execute('driver-1', 'request-1', 'Nota')).rejects.toThrow(
      new BadRequestException(
        'No puedes registrar no-show para un pasajero que ya fue abordado o finalizado.',
      ),
    );

    await expect(useCase.execute('driver-1', 'request-1', '   ')).rejects.toThrow(
      new BadRequestException('Debes indicar una nota para registrar el no-show.'),
    );
  });
});
