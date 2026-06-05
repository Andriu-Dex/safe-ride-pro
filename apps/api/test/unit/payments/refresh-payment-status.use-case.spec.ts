import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppNotificationType, PaymentProvider, TripPaymentStatus } from '@saferidepro/shared-types';

import type { NotificationsService } from '../../../src/modules/notifications/application/services/notifications.service';
import type { TripPaymentRecord, PaymentsRepository } from '../../../src/modules/payments/application/ports/payments.repository';
import type { PaymentProviderPort } from '../../../src/modules/payments/application/ports/payment-provider';
import { RefreshPaymentStatusUseCase } from '../../../src/modules/payments/application/use-cases/refresh-payment-status.use-case';
import type { RealtimeEventsService } from '../../../src/modules/realtime/application/services/realtime-events.service';

type RealtimeEventsServiceMock = Pick<RealtimeEventsService, 'publishTripRequestChanged'>;
type NotificationsServiceMock = Pick<NotificationsService, 'notifyMembership'>;

function createPaymentsRepositoryMock(): jest.Mocked<PaymentsRepository> {
  return {
    findPaymentById: jest.fn(),
    findPaymentByTripRequestId: jest.fn(),
    findPaymentByProviderOrderToken: jest.fn(),
    listPaymentsByTripId: jest.fn(),
    upsertAcceptedTripRequestPayment: jest.fn(),
    recordCheckout: jest.fn(),
    syncPaymentStatus: jest.fn(),
    markPaymentCancelledByTripRequestId: jest.fn(),
    markPaymentRefunded: jest.fn(),
    captureWalletPayment: jest.fn(),
    refundWalletPayment: jest.fn(),
    markPaymentsCancelledByTripId: jest.fn(),
    markCashPaymentPaid: jest.fn(),
    markCashPaymentFailed: jest.fn(),
  };
}

function createPaymentProviderMock(): jest.Mocked<PaymentProviderPort> {
  return {
    name: PaymentProvider.Paypal,
    isConfigured: jest.fn(),
    createCheckout: jest.fn(),
    fetchPaymentStatus: jest.fn(),
    capturePayment: jest.fn(),
    refundPayment: jest.fn(),
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

function buildPayment(overrides: Partial<TripPaymentRecord> = {}): TripPaymentRecord {
  return {
    id: 'payment-1',
    institutionId: 'institution-1',
    tripId: 'trip-1',
    tripRequestId: 'request-1',
    passengerMembershipId: 'membership-passenger',
    passengerUserId: 'user-passenger',
    passengerEmail: 'passenger@uta.edu.ec',
    passengerFullName: 'Andrea Pasajera',
    driverMembershipId: 'membership-driver',
    driverUserId: 'user-driver',
    driverFullName: 'Steven Paredes',
    tripOriginLabel: 'Huachi',
    tripDestinationLabel: 'Centro',
    tripDepartureAt: new Date('2030-01-01T10:00:00.000Z'),
    tripStatus: 'PUBLISHED',
    provider: PaymentProvider.Paypal,
    status: TripPaymentStatus.Pending,
    currencyCode: 'USD',
    amount: 5,
    merchantOrderReference: 'SRP-1',
    providerOrderToken: 'order-1',
    providerPaymentLinkId: null,
    providerPaymentLinkUrl: null,
    providerOrderStatus: null,
    providerPaymentStatus: null,
    failureReason: null,
    paidAt: null,
    cancelledAt: null,
    expiresAt: null,
    lastSyncedAt: null,
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    updatedAt: new Date('2030-01-01T09:00:00.000Z'),
    ...overrides,
  };
}

describe('RefreshPaymentStatusUseCase', () => {
  it('rejects users without access to the payment', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const useCase = new RefreshPaymentStatusUseCase(repository, provider);

    repository.findPaymentById.mockResolvedValue(buildPayment());

    await expect(useCase.execute('other-user', 'payment-1')).rejects.toThrow(
      new ForbiddenException('No tienes acceso a este pago.'),
    );
  });

  it('returns the local payment when no external PayPal order exists yet', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const payment = buildPayment({
      providerOrderToken: null,
    });
    const useCase = new RefreshPaymentStatusUseCase(repository, provider);

    repository.findPaymentById.mockResolvedValue(payment);

    await expect(useCase.execute('user-passenger', 'payment-1')).resolves.toEqual({
      message: 'El pago aun no tiene una orden externa asociada.',
      payment,
    });
  });

  it('requires a configured PayPal provider to consult the status', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    provider.isConfigured.mockReturnValue(false);
    const useCase = new RefreshPaymentStatusUseCase(repository, provider);

    repository.findPaymentById.mockResolvedValue(buildPayment());

    await expect(useCase.execute('user-passenger', 'payment-1')).rejects.toThrow(
      new ServiceUnavailableException(
        'La pasarela PayPal aun no esta configurada en este entorno.',
      ),
    );
  });

  it('publishes a payment confirmation only on the transition to paid', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const realtime = createRealtimeEventsServiceMock();
    const notifications = createNotificationsServiceMock();
    const useCase = new RefreshPaymentStatusUseCase(
      repository,
      provider,
      notifications as unknown as NotificationsService,
      realtime as unknown as RealtimeEventsService,
    );
    const updatedPayment = buildPayment({
      status: TripPaymentStatus.Paid,
      providerPaymentLinkId: 'capture-1',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
      paidAt: new Date('2030-01-01T09:12:00.000Z'),
    });

    repository.findPaymentById.mockResolvedValue(buildPayment());
    provider.isConfigured.mockReturnValue(true);
    provider.fetchPaymentStatus.mockResolvedValue({
      provider: PaymentProvider.Paypal,
      providerOrderToken: 'order-1',
      providerCaptureId: 'capture-1',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
      paidAt: new Date('2030-01-01T09:12:00.000Z'),
      expiresAt: null,
      rawResponse: { id: 'capture-1' },
    });
    repository.syncPaymentStatus.mockResolvedValue(updatedPayment);

    const response = await useCase.execute('user-driver', 'payment-1');

    expect(realtime.publishTripRequestChanged).toHaveBeenCalledTimes(1);
    expect(notifications.notifyMembership).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      recipientMembershipId: 'membership-driver',
      actorUserId: 'user-driver',
      type: AppNotificationType.TripRequestCreated,
      title: 'Solicitud pagada',
      body: 'Andrea Pasajera pago por PayPal y espera tu respuesta.',
      actionUrl: '/viajes/aprobar-solicitudes?experienceMode=driver',
    });
    expect(response.payment.status).toBe(TripPaymentStatus.Paid);
  });

  it('does not emit duplicate events when the payment was already paid before the refresh', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const realtime = createRealtimeEventsServiceMock();
    const notifications = createNotificationsServiceMock();
    const payment = buildPayment({
      status: TripPaymentStatus.Paid,
    });
    const useCase = new RefreshPaymentStatusUseCase(
      repository,
      provider,
      notifications as unknown as NotificationsService,
      realtime as unknown as RealtimeEventsService,
    );

    repository.findPaymentById.mockResolvedValue(payment);
    provider.isConfigured.mockReturnValue(true);
    provider.fetchPaymentStatus.mockResolvedValue({
      provider: PaymentProvider.Paypal,
      providerOrderToken: 'order-1',
      providerCaptureId: 'capture-1',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
      paidAt: new Date('2030-01-01T09:12:00.000Z'),
      expiresAt: null,
      rawResponse: { id: 'capture-1' },
    });
    repository.syncPaymentStatus.mockResolvedValue({
      ...payment,
      providerPaymentLinkId: 'capture-1',
    });

    await useCase.execute('user-passenger', 'payment-1');

    expect(realtime.publishTripRequestChanged).not.toHaveBeenCalled();
    expect(notifications.notifyMembership).not.toHaveBeenCalled();
  });
});
