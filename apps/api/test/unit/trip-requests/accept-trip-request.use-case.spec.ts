import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentProvider, TripPaymentStatus, TripRequestStatus, TripStatus } from '@saferidepro/shared-types';
import { AcceptTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/accept-trip-request.use-case';
import type { TripRequestsRepository, TripRequestRecord } from '../../../src/modules/trip-requests/application/ports/trip-requests.repository';
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

describe('AcceptTripRequestUseCase', () => {
  let repository: jest.Mocked<TripRequestsRepository>;
  let orchestrator: jest.Mocked<TripPaymentsOrchestratorService>;
  let realtime: jest.Mocked<RealtimeEventsService>;
  let notifications: jest.Mocked<NotificationsService>;
  let useCase: AcceptTripRequestUseCase;

  beforeEach(() => {
    repository = {
      findTripRequestById: jest.fn(),
      acceptTripRequest: jest.fn(),
    } as any;

    orchestrator = {
      ensureAcceptedTripRequestPayment: jest.fn(),
    } as any;

    realtime = {
      publishTripRequestChanged: jest.fn(),
    } as any;

    notifications = {
      notifyMembership: jest.fn(),
    } as any;

    useCase = new AcceptTripRequestUseCase(
      repository,
      orchestrator,
      realtime,
      notifications,
    );
  });

  it('accepts the trip request successfully', async () => {
    const record = buildTripRequestRecord();
    repository.findTripRequestById.mockResolvedValue(record);
    repository.acceptTripRequest.mockResolvedValue({
      ...record,
      status: TripRequestStatus.Accepted,
    });

    const result = await useCase.execute('driver-1', 'request-1', 'Notes');

    expect(result.message).toBe('Solicitud aceptada correctamente.');
    expect(repository.acceptTripRequest).toHaveBeenCalledWith('request-1', 'Notes');
    expect(orchestrator.ensureAcceptedTripRequestPayment).toHaveBeenCalledWith('request-1', 'USD');
    expect(realtime.publishTripRequestChanged).toHaveBeenCalled();
    expect(notifications.notifyMembership).toHaveBeenCalled();
  });

  it('throws NotFoundException if the request does not exist', async () => {
    repository.findTripRequestById.mockResolvedValue(null);
    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException if the user is not the driver of the request', async () => {
    repository.findTripRequestById.mockResolvedValue(buildTripRequestRecord({ driverUserId: 'driver-other' }));
    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException if the request is not pending', async () => {
    repository.findTripRequestById.mockResolvedValue(buildTripRequestRecord({ status: TripRequestStatus.Accepted }));
    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if the trip is not published', async () => {
    repository.findTripRequestById.mockResolvedValue(buildTripRequestRecord({ tripStatus: TripStatus.InProgress }));
    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if the trip has no available seats', async () => {
    repository.findTripRequestById.mockResolvedValue(buildTripRequestRecord({ tripAvailableSeats: 0 }));
    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if the payment provider is PayPal and it is not paid', async () => {
    repository.findTripRequestById.mockResolvedValue(
      buildTripRequestRecord({
        payment: {
          id: 'pay-1',
          provider: PaymentProvider.Paypal,
          status: TripPaymentStatus.CheckoutReady,
          amount: 5,
          currencyCode: 'USD',
          checkoutUrl: 'https://paypal.com',
          paidAt: null,
          expiresAt: null,
          updatedAt: new Date(),
        },
      }),
    );
    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if acceptTripRequest fails returning null', async () => {
    repository.findTripRequestById.mockResolvedValue(buildTripRequestRecord());
    repository.acceptTripRequest.mockResolvedValue(null);
    await expect(useCase.execute('driver-1', 'request-1')).rejects.toThrow(
      new BadRequestException('La solicitud ya no pudo aceptarse porque el viaje cambio de estado.'),
    );
  });
});
