import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AppNotificationType,
  CancellationTiming,
  PaymentProvider,
  TripPaymentStatus,
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

import type { NotificationsService } from '../../../src/modules/notifications/application/services/notifications.service';
import type { TripPaymentRecord } from '../../../src/modules/payments/application/ports/payments.repository';
import type { TripPaymentsOrchestratorService } from '../../../src/modules/payments/application/services/trip-payments-orchestrator.service';
import type { RealtimeEventsService } from '../../../src/modules/realtime/application/services/realtime-events.service';
import type {
  TripRequestRecord,
  TripRequestsRepository,
} from '../../../src/modules/trip-requests/application/ports/trip-requests.repository';
import { RejectTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/reject-trip-request.use-case';

type PaymentsOrchestratorMock = Pick<
  TripPaymentsOrchestratorService,
  'cancelTripRequestPayment'
>;
type RealtimeEventsServiceMock = Pick<
  RealtimeEventsService,
  'publishTripRequestChanged'
>;
type NotificationsServiceMock = Pick<NotificationsService, 'notifyMembership'>;

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

function createPaymentsOrchestratorMock(): jest.Mocked<PaymentsOrchestratorMock> {
  return {
    cancelTripRequestPayment: jest.fn(),
  };
}

function createRealtimeEventsServiceMock(): jest.Mocked<RealtimeEventsServiceMock> {
  return {
    publishTripRequestChanged: jest.fn(),
  };
}

function createNotificationsServiceMock(): jest.Mocked<NotificationsServiceMock> {
  return {
    notifyMembership: jest.fn(),
  };
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
    tripOriginLatitude: -1.25,
    tripOriginLongitude: -78.62,
    tripDestinationLabel: 'Centro',
    tripDestinationLatitude: -1.24,
    tripDestinationLongitude: -78.61,
    tripRoutePath: null,
    tripRouteDistanceMeters: null,
    tripRouteDurationSeconds: null,
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
    cancellationTiming: CancellationTiming.OnTime,
    payment: null,
    ...overrides,
  };
}

function buildPayment(
  overrides: Partial<TripPaymentRecord> = {},
): TripPaymentRecord {
  return {
    id: 'payment-1',
    institutionId: 'institution-1',
    tripId: 'trip-1',
    tripRequestId: 'request-1',
    passengerMembershipId: 'membership-passenger',
    passengerUserId: 'user-passenger',
    passengerEmail: 'pasajero@uta.edu.ec',
    passengerFullName: 'Pasajero Uno',
    driverMembershipId: 'membership-driver',
    driverUserId: 'user-driver',
    driverFullName: 'Conductor Uno',
    tripOriginLabel: 'Huachi',
    tripDestinationLabel: 'Centro',
    tripDepartureAt: new Date('2030-01-01T10:00:00.000Z'),
    tripStatus: TripStatus.Published,
    provider: PaymentProvider.Paypal,
    status: TripPaymentStatus.Refunded,
    currencyCode: 'USD',
    amount: 5,
    merchantOrderReference: 'SRP-1',
    providerOrderToken: 'order-1',
    providerPaymentLinkId: 'capture-1',
    providerPaymentLinkUrl: null,
    providerOrderStatus: 'COMPLETED',
    providerPaymentStatus: 'COMPLETED',
    failureReason: 'Pago reembolsado.',
    paidAt: new Date('2030-01-01T09:05:00.000Z'),
    cancelledAt: new Date('2030-01-01T09:10:00.000Z'),
    expiresAt: null,
    lastSyncedAt: new Date('2030-01-01T09:10:00.000Z'),
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    updatedAt: new Date('2030-01-01T09:10:00.000Z'),
    ...overrides,
  };
}

describe('RejectTripRequestUseCase', () => {
  it('fails when the request does not exist', async () => {
    const repository = createTripRequestsRepositoryMock();
    const paymentsOrchestrator = createPaymentsOrchestratorMock();
    const useCase = new RejectTripRequestUseCase(
      repository,
      paymentsOrchestrator as unknown as TripPaymentsOrchestratorService,
    );

    repository.findTripRequestById.mockResolvedValue(null);

    await expect(useCase.execute('user-driver', 'missing-request')).rejects.toThrow(
      new NotFoundException('La solicitud de viaje no existe.'),
    );
  });

  it('blocks users that are not the trip driver', async () => {
    const repository = createTripRequestsRepositoryMock();
    const paymentsOrchestrator = createPaymentsOrchestratorMock();
    const useCase = new RejectTripRequestUseCase(
      repository,
      paymentsOrchestrator as unknown as TripPaymentsOrchestratorService,
    );

    repository.findTripRequestById.mockResolvedValue(buildTripRequest());

    await expect(useCase.execute('other-user', 'request-1')).rejects.toThrow(
      new ForbiddenException(
        'Solo el conductor del viaje puede rechazar esta solicitud.',
      ),
    );
  });

  it('only allows pending requests to be rejected', async () => {
    const repository = createTripRequestsRepositoryMock();
    const paymentsOrchestrator = createPaymentsOrchestratorMock();
    const useCase = new RejectTripRequestUseCase(
      repository,
      paymentsOrchestrator as unknown as TripPaymentsOrchestratorService,
    );

    repository.findTripRequestById.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Accepted,
        executionStatus: TripRequestExecutionStatus.AcceptedPendingBoarding,
      }),
    );

    await expect(useCase.execute('user-driver', 'request-1')).rejects.toThrow(
      new BadRequestException('Solo las solicitudes pendientes pueden rechazarse.'),
    );
  });

  it('fails if the repository can no longer reject the request after payment cancellation', async () => {
    const repository = createTripRequestsRepositoryMock();
    const paymentsOrchestrator = createPaymentsOrchestratorMock();
    const realtimeEventsService = createRealtimeEventsServiceMock();
    const notificationsService = createNotificationsServiceMock();
    const useCase = new RejectTripRequestUseCase(
      repository,
      paymentsOrchestrator as unknown as TripPaymentsOrchestratorService,
      realtimeEventsService as unknown as RealtimeEventsService,
      notificationsService as unknown as NotificationsService,
    );

    repository.findTripRequestById.mockResolvedValue(buildTripRequest());
    paymentsOrchestrator.cancelTripRequestPayment.mockResolvedValue(
      buildPayment({
        provider: PaymentProvider.Wallet,
      }),
    );
    repository.rejectTripRequest.mockResolvedValue(null);

    await expect(useCase.execute('user-driver', 'request-1')).rejects.toThrow(
      new BadRequestException(
        'La solicitud ya no pudo rechazarse por un cambio reciente en su estado.',
      ),
    );

    expect(realtimeEventsService.publishTripRequestChanged).not.toHaveBeenCalled();
    expect(notificationsService.notifyMembership).not.toHaveBeenCalled();
  });

  it('publishes realtime updates and sends a PayPal refund notification', async () => {
    const repository = createTripRequestsRepositoryMock();
    const paymentsOrchestrator = createPaymentsOrchestratorMock();
    const realtimeEventsService = createRealtimeEventsServiceMock();
    const notificationsService = createNotificationsServiceMock();
    const useCase = new RejectTripRequestUseCase(
      repository,
      paymentsOrchestrator as unknown as TripPaymentsOrchestratorService,
      realtimeEventsService as unknown as RealtimeEventsService,
      notificationsService as unknown as NotificationsService,
    );

    repository.findTripRequestById.mockResolvedValue(buildTripRequest());
    paymentsOrchestrator.cancelTripRequestPayment.mockResolvedValue(
      buildPayment({
        provider: PaymentProvider.Paypal,
      }),
    );
    repository.rejectTripRequest.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Rejected,
        reviewNote: 'Ruta fuera de cobertura',
      }),
    );

    const response = await useCase.execute(
      'user-driver',
      'request-1',
      '  Ruta fuera de cobertura  ',
    );

    expect(repository.rejectTripRequest).toHaveBeenCalledWith(
      'request-1',
      'Ruta fuera de cobertura',
    );
    expect(realtimeEventsService.publishTripRequestChanged).toHaveBeenCalledWith({
      actorUserId: 'user-driver',
      driverMembershipId: 'membership-driver',
      institutionId: 'institution-1',
      passengerMembershipId: 'membership-passenger',
      reason: 'rejected',
      requestId: 'request-1',
      tripId: 'trip-1',
    });
    expect(notificationsService.notifyMembership).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      recipientMembershipId: 'membership-passenger',
      actorUserId: 'user-driver',
      type: AppNotificationType.TripRequestRejected,
      title: 'Solicitud rechazada',
      body: 'El conductor rechazo tu solicitud y el pago fue reembolsado por PayPal.',
      actionUrl: '/viajes?passengerView=requests',
    });
    expect(response.message).toBe('Solicitud rechazada y pago reembolsado.');
  });

  it('sends the wallet-specific notification when the retained balance is returned', async () => {
    const repository = createTripRequestsRepositoryMock();
    const paymentsOrchestrator = createPaymentsOrchestratorMock();
    const notificationsService = createNotificationsServiceMock();
    const useCase = new RejectTripRequestUseCase(
      repository,
      paymentsOrchestrator as unknown as TripPaymentsOrchestratorService,
      undefined,
      notificationsService as unknown as NotificationsService,
    );

    repository.findTripRequestById.mockResolvedValue(buildTripRequest());
    paymentsOrchestrator.cancelTripRequestPayment.mockResolvedValue(
      buildPayment({
        provider: PaymentProvider.Wallet,
      }),
    );
    repository.rejectTripRequest.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Rejected,
      }),
    );

    await useCase.execute('user-driver', 'request-1');

    expect(notificationsService.notifyMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'El conductor rechazo tu solicitud y el saldo volvio a tu billetera.',
      }),
    );
  });

  it('returns the standard message when there is no refunded payment to report', async () => {
    const repository = createTripRequestsRepositoryMock();
    const paymentsOrchestrator = createPaymentsOrchestratorMock();
    const notificationsService = createNotificationsServiceMock();
    const useCase = new RejectTripRequestUseCase(
      repository,
      paymentsOrchestrator as unknown as TripPaymentsOrchestratorService,
      undefined,
      notificationsService as unknown as NotificationsService,
    );

    repository.findTripRequestById.mockResolvedValue(
      buildTripRequest({
        tripStatus: TripStatus.Full,
      }),
    );
    paymentsOrchestrator.cancelTripRequestPayment.mockResolvedValue(
      buildPayment({
        status: TripPaymentStatus.Cancelled,
      }),
    );
    repository.rejectTripRequest.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Rejected,
      }),
    );

    const response = await useCase.execute('user-driver', 'request-1');

    expect(notificationsService.notifyMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'El conductor rechazo tu solicitud.',
      }),
    );
    expect(response.message).toBe('Solicitud rechazada correctamente.');
  });

  it('sends the fallback notification when payment is refunded but provider is Cash or other', async () => {
    const repository = createTripRequestsRepositoryMock();
    const paymentsOrchestrator = createPaymentsOrchestratorMock();
    const notificationsService = createNotificationsServiceMock();
    const useCase = new RejectTripRequestUseCase(
      repository,
      paymentsOrchestrator as unknown as TripPaymentsOrchestratorService,
      undefined,
      notificationsService as unknown as NotificationsService,
    );

    repository.findTripRequestById.mockResolvedValue(buildTripRequest());
    paymentsOrchestrator.cancelTripRequestPayment.mockResolvedValue(
      buildPayment({
        provider: 'CASH' as any,
        status: TripPaymentStatus.Refunded,
      }),
    );
    repository.rejectTripRequest.mockResolvedValue(
      buildTripRequest({
        status: TripRequestStatus.Rejected,
      }),
    );

    await useCase.execute('user-driver', 'request-1');

    expect(notificationsService.notifyMembership).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'El conductor rechazo tu solicitud.',
      }),
    );
  });
});
