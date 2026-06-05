import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppNotificationType, PaymentProvider, TripPaymentStatus } from '@saferidepro/shared-types';

import type { NotificationsService } from '../../../src/modules/notifications/application/services/notifications.service';
import type { TripPaymentRecord, PaymentsRepository } from '../../../src/modules/payments/application/ports/payments.repository';
import type { PaymentProviderPort } from '../../../src/modules/payments/application/ports/payment-provider';
import { CapturePaymentUseCase } from '../../../src/modules/payments/application/use-cases/capture-payment.use-case';
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

describe('CapturePaymentUseCase', () => {
  it('rejects access when the payment belongs to another passenger', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const useCase = new CapturePaymentUseCase(repository, provider);

    repository.findPaymentById.mockResolvedValue(buildPayment());

    await expect(useCase.execute('other-user', 'payment-1')).rejects.toThrow(
      new ForbiddenException('Solo el pasajero asociado puede capturar este pago.'),
    );
  });

  it('returns early when the payment is already confirmed', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const payment = buildPayment({
      status: TripPaymentStatus.Paid,
    });
    const useCase = new CapturePaymentUseCase(repository, provider);

    repository.findPaymentById.mockResolvedValue(payment);

    await expect(useCase.execute('user-passenger', 'payment-1')).resolves.toEqual({
      message: 'El pago ya estaba confirmado.',
      payment,
    });
    expect(provider.capturePayment).not.toHaveBeenCalled();
  });

  it('fails when PayPal is not configured in the environment', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    provider.isConfigured.mockReturnValue(false);
    const useCase = new CapturePaymentUseCase(repository, provider);

    repository.findPaymentById.mockResolvedValue(buildPayment());

    await expect(useCase.execute('user-passenger', 'payment-1')).rejects.toThrow(
      new ServiceUnavailableException(
        'La pasarela PayPal aun no esta configurada en este entorno.',
      ),
    );
  });

  it('syncs the payment and notifies the driver when the capture completes', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const notifications = createNotificationsServiceMock();
    const realtime = createRealtimeEventsServiceMock();
    const useCase = new CapturePaymentUseCase(
      repository,
      provider,
      notifications as unknown as NotificationsService,
      realtime as unknown as RealtimeEventsService,
    );
    const paidAt = new Date('2030-01-01T09:10:00.000Z');
    const updatedPayment = buildPayment({
      status: TripPaymentStatus.Paid,
      providerPaymentLinkId: 'capture-1',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
      paidAt,
    });

    repository.findPaymentById.mockResolvedValue(buildPayment());
    provider.isConfigured.mockReturnValue(true);
    provider.capturePayment.mockResolvedValue({
      provider: PaymentProvider.Paypal,
      providerOrderToken: 'order-1',
      providerCaptureId: 'capture-1',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
      paidAt,
      expiresAt: null,
      rawResponse: { id: 'capture-1' },
    });
    repository.syncPaymentStatus.mockResolvedValue(updatedPayment);

    const response = await useCase.execute('user-passenger', 'payment-1');

    expect(repository.syncPaymentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'payment-1',
        status: TripPaymentStatus.Paid,
        providerPaymentLinkId: 'capture-1',
      }),
    );
    expect(realtime.publishTripRequestChanged).toHaveBeenCalledWith({
      actorUserId: 'user-passenger',
      driverMembershipId: 'membership-driver',
      institutionId: 'institution-1',
      passengerMembershipId: 'membership-passenger',
      reason: 'payment_confirmed',
      requestId: 'request-1',
      tripId: 'trip-1',
    });
    expect(notifications.notifyMembership).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      recipientMembershipId: 'membership-driver',
      actorUserId: 'user-passenger',
      type: AppNotificationType.TripRequestCreated,
      title: 'Solicitud pagada',
      body: 'Andrea Pasajera pago por PayPal y espera tu respuesta.',
      actionUrl: '/viajes/aprobar-solicitudes?experienceMode=driver',
    });
    expect(response.payment.status).toBe(TripPaymentStatus.Paid);
  });

  it('fails when the repository can no longer persist the synchronized payment', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const useCase = new CapturePaymentUseCase(repository, provider);

    repository.findPaymentById.mockResolvedValue(buildPayment());
    provider.isConfigured.mockReturnValue(true);
    provider.capturePayment.mockResolvedValue({
      provider: PaymentProvider.Paypal,
      providerOrderToken: 'order-1',
      providerCaptureId: 'capture-1',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
      paidAt: new Date('2030-01-01T09:10:00.000Z'),
      expiresAt: null,
      rawResponse: { id: 'capture-1' },
    });
    repository.syncPaymentStatus.mockResolvedValue(null);

    await expect(useCase.execute('user-passenger', 'payment-1')).rejects.toThrow(
      new NotFoundException('No fue posible confirmar el pago solicitado.'),
    );
  });
});
