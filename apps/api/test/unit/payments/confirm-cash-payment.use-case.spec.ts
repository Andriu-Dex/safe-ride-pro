import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AppNotificationType, PaymentProvider, TripPaymentStatus } from '@saferidepro/shared-types';

import type { NotificationsService } from '../../../src/modules/notifications/application/services/notifications.service';
import type { TripPaymentRecord, PaymentsRepository } from '../../../src/modules/payments/application/ports/payments.repository';
import { ConfirmCashPaymentUseCase } from '../../../src/modules/payments/application/use-cases/confirm-cash-payment.use-case';

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
    provider: PaymentProvider.Cash,
    status: TripPaymentStatus.Pending,
    currencyCode: 'USD',
    amount: 5,
    merchantOrderReference: 'SRP-1',
    providerOrderToken: null,
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

describe('ConfirmCashPaymentUseCase', () => {
  it('fails when the payment does not exist', async () => {
    const repository = createPaymentsRepositoryMock();
    const useCase = new ConfirmCashPaymentUseCase(repository);

    repository.findPaymentById.mockResolvedValue(null);

    await expect(useCase.execute('user-driver', 'missing')).rejects.toThrow(
      new NotFoundException('El pago no existe.'),
    );
  });

  it('only allows the driver and only for cash payments', async () => {
    const repository = createPaymentsRepositoryMock();
    const useCase = new ConfirmCashPaymentUseCase(repository);

    repository.findPaymentById.mockResolvedValue(buildPayment());
    await expect(useCase.execute('other-user', 'payment-1')).rejects.toThrow(
      new ForbiddenException('Solo el conductor puede confirmar este pago.'),
    );

    repository.findPaymentById.mockResolvedValue(
      buildPayment({
        provider: PaymentProvider.Paypal,
      }),
    );
    await expect(useCase.execute('user-driver', 'payment-1')).rejects.toThrow(
      new BadRequestException('Este pago no corresponde a efectivo.'),
    );
  });

  it('marks the payment as paid and notifies the passenger', async () => {
    const repository = createPaymentsRepositoryMock();
    const notifications = createNotificationsServiceMock();
    const useCase = new ConfirmCashPaymentUseCase(
      repository,
      notifications as unknown as NotificationsService,
    );
    const updatedPayment = buildPayment({
      status: TripPaymentStatus.Paid,
    });

    repository.findPaymentById.mockResolvedValue(buildPayment());
    repository.markCashPaymentPaid.mockResolvedValue(updatedPayment);

    const response = await useCase.execute('user-driver', 'payment-1');

    expect(notifications.notifyMembership).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      recipientMembershipId: 'membership-passenger',
      actorUserId: 'user-driver',
      type: AppNotificationType.PaymentConfirmed,
      title: 'Pago confirmado',
      body: 'El conductor marco el pago en efectivo como recibido.',
      actionUrl: '/viajes?passengerView=requests',
    });
    expect(response.message).toBe('Pago en efectivo confirmado.');
  });

  it('fails when the repository cannot persist the confirmation', async () => {
    const repository = createPaymentsRepositoryMock();
    const useCase = new ConfirmCashPaymentUseCase(repository);

    repository.findPaymentById.mockResolvedValue(buildPayment());
    repository.markCashPaymentPaid.mockResolvedValue(null);

    await expect(useCase.execute('user-driver', 'payment-1')).rejects.toThrow(
      new BadRequestException('No se pudo confirmar el pago.'),
    );
  });
});
