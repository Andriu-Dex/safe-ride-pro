import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CancellationTiming, TripRequestStatus, TripStatus } from '@saferidepro/shared-types';
import { CancelTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/cancel-trip-request.use-case';
import type { TripRequestsRepository, TripRequestRecord } from '../../../src/modules/trip-requests/application/ports/trip-requests.repository';
import type { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';
import type { TripPaymentsOrchestratorService } from '../../../src/modules/payments/application/services/trip-payments-orchestrator.service';
import { RealtimeEventsService } from '../../../src/modules/realtime/application/services/realtime-events.service';
import { NotificationsService } from '../../../src/modules/notifications/application/services/notifications.service';

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
    status: TripRequestStatus.Pending,
    executionStatus: 'PENDING' as any,
    tripStatus: TripStatus.Published,
    tripRouteMode: 'DIRECT_ROUTE' as any,
    tripOriginLabel: 'Huachi',
    tripOriginLatitude: -1.25,
    tripOriginLongitude: -78.62,
    tripDestinationLabel: 'Centro',
    tripDestinationLatitude: -1.24,
    tripDestinationLongitude: -78.61,
    tripDepartureAt: new Date(),
    tripEstimatedArrivalAt: new Date(),
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
    executionStatusUpdatedAt: new Date(),
    boardedAt: null,
    droppedOffAt: null,
    createdAt: new Date(),
    reviewedAt: null,
    cancelledAt: null,
    cancellationTiming: null,
    payment: null,
    ...overrides,
  };
}

describe('CancelTripRequestUseCase', () => {
  let repository: jest.Mocked<TripRequestsRepository>;
  let sanctions: jest.Mocked<OperationalSanctionsService>;
  let orchestrator: jest.Mocked<TripPaymentsOrchestratorService>;
  let realtime: jest.Mocked<RealtimeEventsService>;
  let notifications: jest.Mocked<NotificationsService>;
  let useCase: CancelTripRequestUseCase;

  beforeEach(() => {
    repository = {
      findTripRequestById: jest.fn(),
      cancelTripRequest: jest.fn(),
    } as any;

    sanctions = {
      synchronizeAutomaticSanctions: jest.fn(),
    } as any;

    orchestrator = {
      cancelTripRequestPayment: jest.fn(),
    } as any;

    realtime = {
      publishTripRequestChanged: jest.fn(),
    } as any;

    notifications = {
      notifyMembership: jest.fn(),
    } as any;

    useCase = new CancelTripRequestUseCase(
      repository,
      sanctions,
      orchestrator,
      realtime,
      notifications,
    );
  });

  it('cancels the trip request successfully', async () => {
    const record = buildTripRequestRecord();
    repository.findTripRequestById.mockResolvedValue(record);
    repository.cancelTripRequest.mockResolvedValue({
      ...record,
      status: TripRequestStatus.Cancelled,
      cancellationTiming: CancellationTiming.OnTime,
    });

    const result = await useCase.execute('passenger-1', 'request-1');

    expect(result.message).toBe('Solicitud cancelada correctamente.');
    expect(repository.cancelTripRequest).toHaveBeenCalledWith('request-1');
    expect(orchestrator.cancelTripRequestPayment).toHaveBeenCalledWith(
      'request-1',
      'Pago cancelado porque la solicitud fue cancelada por el pasajero.',
    );
    expect(sanctions.synchronizeAutomaticSanctions).not.toHaveBeenCalled();
    expect(realtime.publishTripRequestChanged).toHaveBeenCalled();
    expect(notifications.notifyMembership).toHaveBeenCalled();
  });

  it('triggers sanctions synchronization if the cancellation timing is late', async () => {
    const record = buildTripRequestRecord();
    repository.findTripRequestById.mockResolvedValue(record);
    repository.cancelTripRequest.mockResolvedValue({
      ...record,
      status: TripRequestStatus.Cancelled,
      cancellationTiming: CancellationTiming.Late,
    });

    await useCase.execute('passenger-1', 'request-1');

    expect(sanctions.synchronizeAutomaticSanctions).toHaveBeenCalledWith('membership-passenger');
  });

  it('throws NotFoundException if the request does not exist', async () => {
    repository.findTripRequestById.mockResolvedValue(null);
    await expect(useCase.execute('passenger-1', 'request-1')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException if the user is not the passenger of the request', async () => {
    repository.findTripRequestById.mockResolvedValue(buildTripRequestRecord({ passengerUserId: 'passenger-other' }));
    await expect(useCase.execute('passenger-1', 'request-1')).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException if the status is not pending or accepted', async () => {
    repository.findTripRequestById.mockResolvedValue(buildTripRequestRecord({ status: TripRequestStatus.Cancelled }));
    await expect(useCase.execute('passenger-1', 'request-1')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if the trip is not published or full', async () => {
    repository.findTripRequestById.mockResolvedValue(buildTripRequestRecord({ tripStatus: TripStatus.InProgress }));
    await expect(useCase.execute('passenger-1', 'request-1')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if cancelTripRequest fails returning null', async () => {
    repository.findTripRequestById.mockResolvedValue(buildTripRequestRecord());
    repository.cancelTripRequest.mockResolvedValue(null);
    await expect(useCase.execute('passenger-1', 'request-1')).rejects.toThrow(
      new BadRequestException('La solicitud ya no pudo cancelarse por un cambio reciente en su estado.'),
    );
  });
});
