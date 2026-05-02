import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { MarkTripRequestDroppedOffUseCase } from '../../../src/modules/trip-requests/application/use-cases/mark-trip-request-dropped-off.use-case';
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
    executionStatus: TripRequestExecutionStatus.OnBoard,
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
    executionStatusUpdatedAt: new Date('2030-01-01T10:05:00.000Z'),
    boardedAt: new Date('2030-01-01T10:05:00.000Z'),
    droppedOffAt: null,
    createdAt: new Date('2030-01-01T09:30:00.000Z'),
    reviewedAt: new Date('2030-01-01T09:40:00.000Z'),
    cancelledAt: null,
    cancellationTiming: null,
    payment: null,
    ...overrides,
  };
}

describe('MarkTripRequestDroppedOffUseCase', () => {
  it('marks a boarded passenger as dropped off', async () => {
    const repository = createTripRequestsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new MarkTripRequestDroppedOffUseCase(repository, auditService);

    repository.findTripRequestById.mockResolvedValue(buildTripRequestRecord());
    repository.markTripRequestDroppedOff.mockResolvedValue(
      buildTripRequestRecord({
        executionStatus: TripRequestExecutionStatus.DroppedOff,
        droppedOffAt: new Date('2030-01-01T10:25:00.000Z'),
      }),
    );

    const response = await useCase.execute('driver-1', 'request-1');

    expect(response.message).toBe('Pasajero marcado como finalizado.');
    expect(repository.markTripRequestDroppedOff).toHaveBeenCalledWith('request-1');
    expect(auditService.record).toHaveBeenCalled();
  });

  it('rejects invalid drop-off transitions', async () => {
    const repository = createTripRequestsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new MarkTripRequestDroppedOffUseCase(repository, auditService);

    repository.findTripRequestById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildTripRequestRecord({ driverUserId: 'driver-2' }))
      .mockResolvedValueOnce(buildTripRequestRecord({ status: TripRequestStatus.Pending }))
      .mockResolvedValueOnce(buildTripRequestRecord({ tripStatus: TripStatus.Completed }))
      .mockResolvedValueOnce(
        buildTripRequestRecord({
          executionStatus: TripRequestExecutionStatus.AcceptedPendingBoarding,
        }),
      );

    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(
      new NotFoundException('La solicitud de viaje no existe.'),
    );
    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(
      new ForbiddenException(
        'Solo el conductor del viaje puede marcar el cierre del pasajero.',
      ),
    );
    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(
      new BadRequestException('Solo las solicitudes aceptadas pueden cerrarse operativamente.'),
    );
    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(
      new BadRequestException('Solo puedes cerrar pasajeros cuando el viaje esta en curso.'),
    );
    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(
      new BadRequestException(
        'Solo puedes marcar finalizacion para pasajeros que ya fueron abordados.',
      ),
    );
  });
});
