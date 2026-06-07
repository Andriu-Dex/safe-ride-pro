import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentProvider, TripPaymentStatus } from '@saferidepro/shared-types';

import type { TripPaymentRecord, PaymentsRepository } from '../../../src/modules/payments/application/ports/payments.repository';
import type { PaymentProviderPort } from '../../../src/modules/payments/application/ports/payment-provider';
import { CreatePaymentCheckoutLinkUseCase } from '../../../src/modules/payments/application/use-cases/create-payment-checkout-link.use-case';

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
    amount: 10,
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

describe('CreatePaymentCheckoutLinkUseCase', () => {
  it('fails when the payment does not exist', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const useCase = new CreatePaymentCheckoutLinkUseCase(repository, provider);

    repository.findPaymentById.mockResolvedValue(null);

    await expect(useCase.execute('user-passenger', 'missing')).rejects.toThrow(
      new NotFoundException('El pago solicitado no existe.'),
    );
  });

  it('rejects users that do not own the payment', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const useCase = new CreatePaymentCheckoutLinkUseCase(repository, provider);

    repository.findPaymentById.mockResolvedValue(buildPayment());

    await expect(useCase.execute('other-user', 'payment-1')).rejects.toThrow(
      new ForbiddenException('Solo el pasajero asociado puede iniciar este pago.'),
    );
  });

  it('blocks non-PayPal payments and unavailable payment states', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const useCase = new CreatePaymentCheckoutLinkUseCase(repository, provider);

    repository.findPaymentById.mockResolvedValue(
      buildPayment({
        provider: PaymentProvider.Cash,
      }),
    );
    await expect(useCase.execute('user-passenger', 'payment-1')).rejects.toThrow(
      new BadRequestException('Este pago no corresponde a PayPal.'),
    );

    repository.findPaymentById.mockResolvedValue(
      buildPayment({
        status: TripPaymentStatus.Paid,
      }),
    );
    await expect(useCase.execute('user-passenger', 'payment-1')).rejects.toThrow(
      new BadRequestException('Este pago ya fue completado.'),
    );

    repository.findPaymentById.mockResolvedValue(
      buildPayment({
        status: TripPaymentStatus.Cancelled,
      }),
    );
    await expect(useCase.execute('user-passenger', 'payment-1')).rejects.toThrow(
      new BadRequestException('Este pago ya no se encuentra disponible.'),
    );
  });

  it('requires a configured PayPal provider before creating the checkout', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    provider.isConfigured.mockReturnValue(false);
    const useCase = new CreatePaymentCheckoutLinkUseCase(repository, provider);

    repository.findPaymentById.mockResolvedValue(buildPayment());

    await expect(useCase.execute('user-passenger', 'payment-1')).rejects.toThrow(
      new ServiceUnavailableException(
        'La pasarela PayPal aun no esta configurada en este entorno.',
      ),
    );
  });

  it('creates and persists the checkout link', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const useCase = new CreatePaymentCheckoutLinkUseCase(repository, provider);
    const expiresAt = new Date('2030-01-01T09:30:00.000Z');
    const updatedPayment = buildPayment({
      status: TripPaymentStatus.CheckoutReady,
      providerOrderToken: 'order-1',
      providerPaymentLinkId: 'link-1',
      providerPaymentLinkUrl: 'https://paypal.example/checkout',
      providerOrderStatus: 'CREATED',
    });

    repository.findPaymentById.mockResolvedValue(buildPayment());
    provider.isConfigured.mockReturnValue(true);
    provider.createCheckout.mockResolvedValue({
      provider: PaymentProvider.Paypal,
      checkoutUrl: 'https://paypal.example/checkout',
      providerOrderToken: 'order-1',
      providerPaymentLinkId: 'link-1',
      providerOrderStatus: 'CREATED',
      providerPaymentStatus: null,
      expiresAt,
      rawResponse: { id: 'order-1' },
    });
    repository.recordCheckout.mockResolvedValue(updatedPayment);

    const response = await useCase.execute('user-passenger', 'payment-1');

    expect(provider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'payment-1',
        merchantOrderReference: 'SRP-1',
        amount: 10,
        currencyCode: 'USD',
      }),
    );
    expect(repository.recordCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'payment-1',
        status: TripPaymentStatus.CheckoutReady,
        checkoutUrl: 'https://paypal.example/checkout',
        providerOrderToken: 'order-1',
        expiresAt,
      }),
    );
    expect(response.checkoutUrl).toBe('https://paypal.example/checkout');
  });

  it('creates and persists the checkout link with PAID status if already paid by provider', async () => {
    const repository = createPaymentsRepositoryMock();
    const provider = createPaymentProviderMock();
    const useCase = new CreatePaymentCheckoutLinkUseCase(repository, provider);
    const expiresAt = new Date('2030-01-01T09:30:00.000Z');
    const updatedPayment = buildPayment({
      status: TripPaymentStatus.Paid,
      providerOrderToken: 'order-1',
      providerPaymentLinkId: 'link-1',
      providerPaymentLinkUrl: 'https://paypal.example/checkout',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
    });

    repository.findPaymentById.mockResolvedValue(buildPayment());
    provider.isConfigured.mockReturnValue(true);
    provider.createCheckout.mockResolvedValue({
      provider: PaymentProvider.Paypal,
      checkoutUrl: 'https://paypal.example/checkout',
      providerOrderToken: 'order-1',
      providerPaymentLinkId: 'link-1',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
      expiresAt,
      rawResponse: { id: 'order-1' },
    });
    repository.recordCheckout.mockResolvedValue(updatedPayment);

    const response = await useCase.execute('user-passenger', 'payment-1');

    expect(repository.recordCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'payment-1',
        status: TripPaymentStatus.Paid,
        checkoutUrl: 'https://paypal.example/checkout',
        providerOrderToken: 'order-1',
        expiresAt,
      }),
    );
    expect(response.payment.status).toBe(TripPaymentStatus.Paid);
  });
});
