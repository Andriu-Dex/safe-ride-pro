import { BadRequestException } from '@nestjs/common';
import {
  CancellationTiming,
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

import { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';
import { AcceptTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/accept-trip-request.use-case';
import { CancelTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/cancel-trip-request.use-case';
import { RejectTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/reject-trip-request.use-case';
import type { TripRequestRecord, TripRequestsRepository } from '../../../src/modules/trip-requests/application/ports/trip-requests.repository';

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

function buildTripRequest(
  overrides: Partial<TripRequestRecord> = {},
): TripRequestRecord {
  return {
    id: 'request-1',
    tripId: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    driverMembershipId: 'membership-driver',
    driverUserId: 'user-driver',
    driverFullName: 'Conductor Uno',
    passengerMembershipId: 'membership-passenger',
    passengerUserId: 'user-passenger',
    passengerFullName: 'Pasajero Uno',
    status: TripRequestStatus.Pending,
    executionStatus: null,
    tripStatus: TripStatus.Published,
    tripRouteMode: TripRouteMode.DirectRoute,
    tripOriginLabel: 'Huachi',
    tripDestinationLabel: 'Centro',
    tripDepartureAt: new Date('2030-01-01T10:00:00.000Z'),
    tripEstimatedArrivalAt: new Date('2030-01-01T10:30:00.000Z'),
    tripCompletedAt: null,
    tripClosureNote: null,
    tripCancelledAt: null,
    tripSeatCount: 4,
    tripAvailableSeats: 2,
    requestedPickupLatitude: null,
    requestedPickupLongitude: null,
    requestedDropoffLatitude: null,
    requestedDropoffLongitude: null,
    requestMessage: null,
    reviewNote: null,
    executionStatusUpdatedAt: null,
    boardedAt: null,
    droppedOffAt: null,
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    reviewedAt: null,
    cancelledAt: null,
    cancellationTiming: null,
    payment: null,
    ...overrides,
  } as TripRequestRecord;
}

describe('Trip request seat adjustment use cases', () => {
  it('accepts a pending request and trims the review note before delegating', async () => {
    const repository = createTripRequestsRepositoryMock();
    const useCase = new AcceptTripRequestUseCase(repository);

    repository.findTripRequestById.mockResolvedValue(buildTripRequest());
    repository.acceptTripRequest.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Accepted,
        executionStatus: TripRequestExecutionStatus.AcceptedPendingBoarding,
        tripAvailableSeats: 1,
        reviewNote: 'Aprobado',
      }),
    );

    const response = await useCase.execute('user-driver', 'request-1', '  Aprobado  ');

    expect(response.message).toBe('Solicitud aceptada correctamente.');
    expect(repository.acceptTripRequest).toHaveBeenCalledWith('request-1', 'Aprobado');
    expect(response.tripRequest.tripAvailableSeats).toBe(1);
  });

  it('rejects acceptance when the trip has no seats available', async () => {
    const repository = createTripRequestsRepositoryMock();
    const useCase = new AcceptTripRequestUseCase(repository);

    repository.findTripRequestById.mockResolvedValue(
      buildTripRequest({
        tripAvailableSeats: 0,
      }),
    );

    await expect(
      useCase.execute('user-driver', 'request-1'),
    ).rejects.toThrow(
      new BadRequestException('El viaje ya no tiene cupos disponibles.'),
    );

    expect(repository.acceptTripRequest).not.toHaveBeenCalled();
  });

  it('blocks accepting a pending request after the trip changed state', async () => {
    const repository = createTripRequestsRepositoryMock();
    const useCase = new AcceptTripRequestUseCase(repository);

    repository.findTripRequestById.mockResolvedValue(
      buildTripRequest({
        tripStatus: TripStatus.Cancelled,
      }),
    );

    await expect(
      useCase.execute('user-driver', 'request-1'),
    ).rejects.toThrow(
      new BadRequestException(
        'La solicitud ya no puede aceptarse porque el viaje cambio de estado.',
      ),
    );

    expect(repository.acceptTripRequest).not.toHaveBeenCalled();
  });

  it('rejects a pending request without consuming seats', async () => {
    const repository = createTripRequestsRepositoryMock();
    const useCase = new RejectTripRequestUseCase(repository);

    repository.findTripRequestById.mockResolvedValue(buildTripRequest());
    repository.rejectTripRequest.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Rejected,
        tripAvailableSeats: 2,
        reviewNote: 'No coincide la ruta',
      }),
    );

    const response = await useCase.execute(
      'user-driver',
      'request-1',
      '  No coincide la ruta  ',
    );

    expect(response.message).toBe('Solicitud rechazada correctamente.');
    expect(repository.rejectTripRequest).toHaveBeenCalledWith(
      'request-1',
      'No coincide la ruta',
    );
    expect(response.tripRequest.tripAvailableSeats).toBe(2);
  });

  it('blocks rejecting a pending request after the trip is already in progress', async () => {
    const repository = createTripRequestsRepositoryMock();
    const useCase = new RejectTripRequestUseCase(repository);

    repository.findTripRequestById.mockResolvedValue(
      buildTripRequest({
        tripStatus: TripStatus.InProgress,
      }),
    );

    await expect(
      useCase.execute('user-driver', 'request-1'),
    ).rejects.toThrow(
      new BadRequestException(
        'La solicitud ya no puede rechazarse porque el viaje cambio de estado.',
      ),
    );

    expect(repository.rejectTripRequest).not.toHaveBeenCalled();
  });

  it('cancels an accepted request and delegates seat release to the repository', async () => {
    const repository = createTripRequestsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CancelTripRequestUseCase(repository, sanctionsService);

    repository.findTripRequestById.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Accepted,
        executionStatus: TripRequestExecutionStatus.AcceptedPendingBoarding,
        tripAvailableSeats: 1,
      }),
    );
    repository.cancelTripRequest.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Cancelled,
        executionStatus: TripRequestExecutionStatus.CancelledBeforeBoarding,
        tripAvailableSeats: 2,
        cancelledAt: new Date('2030-01-01T09:30:00.000Z'),
      }),
    );

    const response = await useCase.execute('user-passenger', 'request-1');

    expect(response.message).toBe('Solicitud cancelada correctamente.');
    expect(repository.cancelTripRequest).toHaveBeenCalledWith('request-1');
    expect(response.tripRequest.status).toBe(TripRequestStatus.Cancelled);
    expect(response.tripRequest.tripAvailableSeats).toBe(2);
    expect(sanctionsService.synchronizeAutomaticSanctions).not.toHaveBeenCalled();
  });

  it('blocks cancelling a request after the trip changed state', async () => {
    const repository = createTripRequestsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CancelTripRequestUseCase(repository, sanctionsService);

    repository.findTripRequestById.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Accepted,
        tripStatus: TripStatus.Cancelled,
      }),
    );

    await expect(
      useCase.execute('user-passenger', 'request-1'),
    ).rejects.toThrow(
      new BadRequestException(
        'La solicitud ya no puede cancelarse porque el viaje cambio de estado.',
      ),
    );

    expect(repository.cancelTripRequest).not.toHaveBeenCalled();
  });

  it('recalculates sanctions after a late passenger cancellation', async () => {
    const repository = createTripRequestsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CancelTripRequestUseCase(repository, sanctionsService);

    repository.findTripRequestById.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Accepted,
        executionStatus: TripRequestExecutionStatus.AcceptedPendingBoarding,
        tripAvailableSeats: 1,
      }),
    );
    repository.cancelTripRequest.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Cancelled,
        executionStatus: TripRequestExecutionStatus.CancelledBeforeBoarding,
        tripAvailableSeats: 2,
        cancelledAt: new Date('2030-01-01T09:50:00.000Z'),
        cancellationTiming: CancellationTiming.Late,
      }),
    );

    await useCase.execute('user-passenger', 'request-1');

    expect(sanctionsService.synchronizeAutomaticSanctions).toHaveBeenCalledWith(
      'membership-passenger',
    );
  });
});
