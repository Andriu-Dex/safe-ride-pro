import { ServiceUnavailableException } from '@nestjs/common';
import { PaymentProvider, TripPaymentStatus } from '@saferidepro/shared-types';

import { TripPaymentsOrchestratorService } from '../../../src/modules/payments/application/services/trip-payments-orchestrator.service';
import type { PaymentProviderPort } from '../../../src/modules/payments/application/ports/payment-provider';
import type {
  PaymentsRepository,
  TripPaymentRecord,
} from '../../../src/modules/payments/application/ports/payments.repository';

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
    isConfigured: jest.fn(() => true),
    createCheckout: jest.fn(),
    fetchPaymentStatus: jest.fn(),
    capturePayment: jest.fn(),
    refundPayment: jest.fn(),
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
    passengerEmail: 'pasajero@uta.edu.ec',
    passengerFullName: 'Andrea Pasajera',
    driverMembershipId: 'membership-driver',
    driverUserId: 'user-driver',
    driverFullName: 'Steven Paredes',
    tripOriginLabel: 'UTA',
    tripDestinationLabel: 'Centro',
    tripDepartureAt: new Date('2030-01-01T10:00:00.000Z'),
    tripStatus: 'PUBLISHED',
    provider: PaymentProvider.Paypal,
    status: TripPaymentStatus.Paid,
    currencyCode: 'USD',
    amount: 10,
    merchantOrderReference: 'SRP-ORDER-1',
    providerOrderToken: 'provider-order-1',
    providerPaymentLinkId: 'provider-capture-1',
    providerPaymentLinkUrl: 'https://paypal.example/checkout',
    providerOrderStatus: 'COMPLETED',
    providerPaymentStatus: 'COMPLETED',
    failureReason: null,
    paidAt: new Date('2030-01-01T09:30:00.000Z'),
    cancelledAt: null,
    expiresAt: null,
    lastSyncedAt: new Date('2030-01-01T09:30:00.000Z'),
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    updatedAt: new Date('2030-01-01T09:30:00.000Z'),
    ...overrides,
  };
}

describe('TripPaymentsOrchestratorService', () => {
  it('captures wallet funds when the driver accepts a wallet request', async () => {
    const repository = createPaymentsRepositoryMock();
    const service = new TripPaymentsOrchestratorService(repository);
    const walletPayment = buildPayment({
      provider: PaymentProvider.Wallet,
      status: TripPaymentStatus.Paid,
    });
    const capturedPayment = buildPayment({
      id: walletPayment.id,
      provider: PaymentProvider.Wallet,
      status: TripPaymentStatus.Paid,
    });

    repository.upsertAcceptedTripRequestPayment.mockResolvedValue(walletPayment);
    repository.captureWalletPayment.mockResolvedValue(capturedPayment);

    const response = await service.ensureAcceptedTripRequestPayment('request-1', 'USD');

    expect(response).toBe(capturedPayment);
    expect(repository.upsertAcceptedTripRequestPayment).toHaveBeenCalledWith({
      tripRequestId: 'request-1',
      currencyCode: 'USD',
    });
    expect(repository.captureWalletPayment).toHaveBeenCalledWith('payment-1');
  });

  it('releases or refunds wallet funds when the request is rejected or cancelled', async () => {
    const repository = createPaymentsRepositoryMock();
    const service = new TripPaymentsOrchestratorService(repository);
    const walletPayment = buildPayment({
      provider: PaymentProvider.Wallet,
      status: TripPaymentStatus.Paid,
    });
    const refundedPayment = buildPayment({
      id: walletPayment.id,
      provider: PaymentProvider.Wallet,
      status: TripPaymentStatus.Refunded,
      failureReason: 'Solicitud rechazada.',
    });

    repository.findPaymentByTripRequestId.mockResolvedValue(walletPayment);
    repository.refundWalletPayment.mockResolvedValue(refundedPayment);

    const response = await service.cancelTripRequestPayment(
      'request-1',
      'Solicitud rechazada.',
    );

    expect(response).toBe(refundedPayment);
    expect(repository.refundWalletPayment).toHaveBeenCalledWith(
      'payment-1',
      'Solicitud rechazada.',
    );
    expect(repository.markPaymentCancelledByTripRequestId).not.toHaveBeenCalled();
  });

  it('refunds a completed PayPal payment through the provider', async () => {
    const repository = createPaymentsRepositoryMock();
    const paymentProvider = createPaymentProviderMock();
    const service = new TripPaymentsOrchestratorService(repository, paymentProvider);
    const paypalPayment = buildPayment();
    const refundedAt = new Date('2030-01-01T10:00:00.000Z');
    const refundedPayment = buildPayment({
      status: TripPaymentStatus.Refunded,
      failureReason: 'Conductor rechazo la solicitud.',
    });

    repository.findPaymentByTripRequestId.mockResolvedValue(paypalPayment);
    paymentProvider.refundPayment.mockResolvedValue({
      provider: PaymentProvider.Paypal,
      providerOrderToken: paypalPayment.providerOrderToken,
      providerCaptureId: 'provider-refund-1',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'REFUNDED',
      refundedAt,
      rawResponse: { id: 'provider-refund-1' },
    });
    repository.markPaymentRefunded.mockResolvedValue(refundedPayment);

    const response = await service.cancelTripRequestPayment(
      'request-1',
      'Conductor rechazo la solicitud.',
    );

    expect(response).toBe(refundedPayment);
    expect(paymentProvider.refundPayment).toHaveBeenCalledWith({
      providerOrderToken: 'provider-order-1',
      providerCaptureId: 'provider-capture-1',
    });
    expect(repository.markPaymentRefunded).toHaveBeenCalledWith({
      paymentId: 'payment-1',
      failureReason: 'Conductor rechazo la solicitud.',
      providerPaymentLinkId: 'provider-refund-1',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'REFUNDED',
      refundedAt,
      responsePayload: { id: 'provider-refund-1' },
    });
  });

  it('blocks closing paid PayPal payments when the provider is not configured', async () => {
    const repository = createPaymentsRepositoryMock();
    const paymentProvider = createPaymentProviderMock();
    const service = new TripPaymentsOrchestratorService(repository, paymentProvider);

    paymentProvider.isConfigured.mockReturnValue(false);
    repository.findPaymentByTripRequestId.mockResolvedValue(buildPayment());

    await expect(
      service.cancelTripRequestPayment('request-1', 'Solicitud rechazada.'),
    ).rejects.toThrow(
      new ServiceUnavailableException(
        'No fue posible reembolsar el pago PayPal en este entorno.',
      ),
    );

    expect(paymentProvider.refundPayment).not.toHaveBeenCalled();
    expect(repository.markPaymentRefunded).not.toHaveBeenCalled();
  });

  it('cancels checkout-ready PayPal payments without refunding money', async () => {
    const repository = createPaymentsRepositoryMock();
    const paymentProvider = createPaymentProviderMock();
    const service = new TripPaymentsOrchestratorService(repository, paymentProvider);
    const checkoutPayment = buildPayment({
      status: TripPaymentStatus.CheckoutReady,
      paidAt: null,
    });
    const cancelledPayment = buildPayment({
      status: TripPaymentStatus.Cancelled,
      paidAt: null,
      cancelledAt: new Date('2030-01-01T10:00:00.000Z'),
    });

    repository.findPaymentByTripRequestId.mockResolvedValue(checkoutPayment);
    repository.markPaymentCancelledByTripRequestId.mockResolvedValue(cancelledPayment);

    const response = await service.cancelTripRequestPayment(
      'request-1',
      'Pago no completado.',
    );

    expect(response).toBe(cancelledPayment);
    expect(paymentProvider.refundPayment).not.toHaveBeenCalled();
    expect(repository.markPaymentCancelledByTripRequestId).toHaveBeenCalledWith(
      'request-1',
      'Pago no completado.',
    );
  });

  it('returns payment directly when payment provider is not wallet or status is not paid', async () => {
    const repository = createPaymentsRepositoryMock();
    const service = new TripPaymentsOrchestratorService(repository);
    const paypalPayment = buildPayment({
      provider: PaymentProvider.Paypal,
      status: TripPaymentStatus.CheckoutReady,
    });

    repository.upsertAcceptedTripRequestPayment.mockResolvedValue(paypalPayment);

    const response = await service.ensureAcceptedTripRequestPayment('request-1', 'USD');

    expect(response).toBe(paypalPayment);
    expect(repository.captureWalletPayment).not.toHaveBeenCalled();
  });

  it('returns null if payment to cancel is not found', async () => {
    const repository = createPaymentsRepositoryMock();
    const service = new TripPaymentsOrchestratorService(repository);

    repository.findPaymentByTripRequestId.mockResolvedValue(null);

    const response = await service.cancelTripRequestPayment('request-1', 'Reason');

    expect(response).toBeNull();
  });

  it('cancels all payments for a trip and returns the count', async () => {
    const repository = createPaymentsRepositoryMock();
    const service = new TripPaymentsOrchestratorService(repository);
    const payments = [
      buildPayment({ id: 'payment-1', status: TripPaymentStatus.CheckoutReady }),
      buildPayment({ id: 'payment-2', status: TripPaymentStatus.Cancelled }),
    ];

    repository.listPaymentsByTripId.mockResolvedValue(payments);
    repository.markPaymentCancelledByTripRequestId.mockImplementation(async (reqId) => {
      return buildPayment({ tripRequestId: reqId, status: TripPaymentStatus.Cancelled });
    });

    const count = await service.cancelTripPayments('trip-1', 'Cancel trip');

    expect(count).toBe(2);
    expect(repository.listPaymentsByTripId).toHaveBeenCalledWith('trip-1');
  });

  it('returns payment directly if it is already closed (cancelled, refunded, or expired)', async () => {
    const repository = createPaymentsRepositoryMock();
    const service = new TripPaymentsOrchestratorService(repository);

    const cancelledPayment = buildPayment({ status: TripPaymentStatus.Cancelled });
    repository.findPaymentByTripRequestId.mockResolvedValue(cancelledPayment);
    let response = await service.cancelTripRequestPayment('request-1', 'Cancel');
    expect(response).toBe(cancelledPayment);

    const refundedPayment = buildPayment({ status: TripPaymentStatus.Refunded });
    repository.findPaymentByTripRequestId.mockResolvedValue(refundedPayment);
    response = await service.cancelTripRequestPayment('request-1', 'Cancel');
    expect(response).toBe(refundedPayment);

    const expiredPayment = buildPayment({ status: TripPaymentStatus.Expired });
    repository.findPaymentByTripRequestId.mockResolvedValue(expiredPayment);
    response = await service.cancelTripRequestPayment('request-1', 'Cancel');
    expect(response).toBe(expiredPayment);
  });

  it('returns payment directly if it is Paid but has an unknown provider', async () => {
    const repository = createPaymentsRepositoryMock();
    const service = new TripPaymentsOrchestratorService(repository);
    const unknownPayment = buildPayment({
      provider: 'UNKNOWN' as any,
      status: TripPaymentStatus.Paid,
    });

    repository.findPaymentByTripRequestId.mockResolvedValue(unknownPayment);

    const response = await service.cancelTripRequestPayment('request-1', 'Cancel');

    expect(response).toBe(unknownPayment);
  });
});
