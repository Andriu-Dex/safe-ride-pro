import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { MembershipStatus, PaymentProvider } from '@saferidepro/shared-types';

import type { PaymentProviderPort } from '../../../src/modules/payments/application/ports/payment-provider';
import { WalletService } from '../../../src/modules/wallet/application/services/wallet.service';

function decimal(value: number) {
  return {
    toString: () => value.toFixed(2),
  };
}

function createPrismaMock() {
  return {
    userInstitutionMembership: {
      findFirst: jest.fn(),
    },
    walletAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    walletTopUp: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    walletLedgerEntry: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
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

const membership = {
  id: 'membership-1',
  userId: 'user-1',
  institutionId: 'institution-1',
  membershipStatus: MembershipStatus.Active,
  isDefault: true,
  joinedAt: new Date('2030-01-01T08:00:00.000Z'),
  user: {
    email: 'andrea@uta.edu.ec',
    fullName: 'Andrea Pasajera',
  },
};

const wallet = {
  id: 'wallet-1',
  membershipId: 'membership-1',
  institutionId: 'institution-1',
  currencyCode: 'USD',
  availableBalance: decimal(20),
  heldBalance: decimal(5),
  updatedAt: new Date('2030-01-01T09:00:00.000Z'),
};

describe('WalletService', () => {
  it('returns the wallet summary and creates a wallet when the membership has none', async () => {
    const prisma = createPrismaMock();
    const service = new WalletService(prisma as never);
    const createdWallet = { ...wallet, availableBalance: decimal(0), heldBalance: decimal(0) };

    prisma.userInstitutionMembership.findFirst.mockResolvedValue(membership);
    prisma.walletAccount.findUnique.mockResolvedValue(null);
    prisma.walletAccount.create.mockResolvedValue(createdWallet);
    prisma.walletAccount.findUniqueOrThrow.mockResolvedValue({
      ...createdWallet,
      ledgerEntries: [
        {
          id: 'ledger-1',
          type: 'TOP_UP_CAPTURED',
          amount: decimal(10),
          availableBalanceAfter: decimal(10),
          heldBalanceAfter: decimal(0),
          note: 'Recarga PayPal acreditada.',
          createdAt: new Date('2030-01-01T09:30:00.000Z'),
        },
      ],
      topUps: [
        {
          id: 'top-up-1',
          provider: PaymentProvider.Paypal,
          status: 'PAID',
          currencyCode: 'USD',
          amount: decimal(10),
          providerPaymentLinkUrl: null,
          paidAt: new Date('2030-01-01T09:30:00.000Z'),
          expiresAt: null,
          updatedAt: new Date('2030-01-01T09:30:00.000Z'),
          createdAt: new Date('2030-01-01T09:20:00.000Z'),
        },
      ],
    });

    const response = await service.getWallet('user-1');

    expect(prisma.walletAccount.create).toHaveBeenCalledWith({
      data: {
        membershipId: 'membership-1',
        institutionId: 'institution-1',
        currencyCode: 'USD',
      },
    });
    expect(response.account.availableBalance).toBe(0);
    expect(response.movements).toHaveLength(1);
    expect(response.topUps[0]).toMatchObject({
      id: 'top-up-1',
      status: 'PAID',
      amount: 10,
    });
  });

  it('blocks top ups when PayPal is not configured', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma as never, provider);

    provider.isConfigured.mockReturnValue(false);

    await expect(service.createTopUp('user-1', 10)).rejects.toThrow(
      new ServiceUnavailableException('PayPal aun no esta configurado para recargas.'),
    );
    expect(prisma.userInstitutionMembership.findFirst).not.toHaveBeenCalled();
  });

  it('validates top up amount limits before creating the provider checkout', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma as never, provider);

    prisma.userInstitutionMembership.findFirst.mockResolvedValue(membership);
    prisma.walletAccount.findUnique.mockResolvedValue(wallet);

    await expect(service.createTopUp('user-1', 250)).rejects.toThrow(
      new BadRequestException('El monto de recarga debe estar entre $1 y $200.'),
    );

    expect(prisma.walletTopUp.create).not.toHaveBeenCalled();
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it('creates a PayPal checkout for a wallet top up', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma as never, provider);
    const createdAt = new Date('2030-01-01T09:00:00.000Z');
    const expiresAt = new Date('2030-01-01T09:30:00.000Z');

    prisma.userInstitutionMembership.findFirst.mockResolvedValue(membership);
    prisma.walletAccount.findUnique.mockResolvedValue(wallet);
    prisma.walletTopUp.create.mockResolvedValue({
      id: 'top-up-1',
      walletId: 'wallet-1',
      provider: PaymentProvider.Paypal,
      status: 'PENDING',
      currencyCode: 'USD',
      amount: decimal(15),
      merchantOrderReference: 'SRP-WALLET-123',
      providerPaymentLinkUrl: null,
      paidAt: null,
      expiresAt: null,
      updatedAt: createdAt,
      createdAt,
      wallet: {
        membership: {
          user: membership.user,
        },
      },
    });
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
    prisma.walletTopUp.update.mockResolvedValue({
      id: 'top-up-1',
      provider: PaymentProvider.Paypal,
      status: 'CHECKOUT_READY',
      currencyCode: 'USD',
      amount: decimal(15),
      providerPaymentLinkUrl: 'https://paypal.example/checkout',
      paidAt: null,
      expiresAt,
      updatedAt: createdAt,
      createdAt,
    });

    const response = await service.createTopUp('user-1', 15);

    expect(provider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'top-up-1',
        amount: 15,
        currencyCode: 'USD',
        passengerEmail: 'andrea@uta.edu.ec',
        successPath: '/billetera',
        cancelPath: '/billetera',
      }),
    );
    expect(response.checkoutUrl).toBe('https://paypal.example/checkout');
    expect(response.topUp).toMatchObject({
      id: 'top-up-1',
      status: 'CHECKOUT_READY',
      amount: 15,
    });
  });

  it('returns the current wallet immediately when the top up was already paid', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma as never, provider);
    const paidAt = new Date('2030-01-01T09:30:00.000Z');

    prisma.walletTopUp.findFirst.mockResolvedValue({
      id: 'top-up-1',
      walletId: 'wallet-1',
      provider: PaymentProvider.Paypal,
      status: 'PAID',
      currencyCode: 'USD',
      amount: decimal(20),
      providerOrderToken: 'order-1',
      providerPaymentLinkId: 'capture-1',
      providerPaymentLinkUrl: 'https://paypal.example/checkout',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
      paidAt,
      expiresAt: null,
      updatedAt: paidAt,
      createdAt: new Date('2030-01-01T09:00:00.000Z'),
    });
    prisma.walletAccount.findUniqueOrThrow.mockResolvedValue({
      ...wallet,
      ledgerEntries: [],
      topUps: [
        {
          id: 'top-up-1',
          provider: PaymentProvider.Paypal,
          status: 'PAID',
          currencyCode: 'USD',
          amount: decimal(20),
          providerPaymentLinkUrl: 'https://paypal.example/checkout',
          paidAt,
          expiresAt: null,
          updatedAt: paidAt,
          createdAt: new Date('2030-01-01T09:00:00.000Z'),
        },
      ],
    });

    const response = await service.captureTopUp('user-1', 'top-up-1');

    expect(provider.capturePayment).not.toHaveBeenCalled();
    expect(response.message).toBe('Recarga acreditada.');
    expect(response.wallet.account.availableBalance).toBe(20);
  });

  it('requires an associated PayPal order before capturing or refreshing a top up', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma as never, provider);
    const topUp = {
      id: 'top-up-1',
      walletId: 'wallet-1',
      provider: PaymentProvider.Paypal,
      status: 'CHECKOUT_READY',
      currencyCode: 'USD',
      amount: decimal(20),
      providerOrderToken: null,
      providerPaymentLinkId: null,
      providerPaymentLinkUrl: null,
      providerOrderStatus: 'CREATED',
      providerPaymentStatus: null,
      paidAt: null,
      expiresAt: null,
      updatedAt: new Date('2030-01-01T09:00:00.000Z'),
      createdAt: new Date('2030-01-01T09:00:00.000Z'),
    };

    prisma.walletTopUp.findFirst.mockResolvedValue(topUp);

    await expect(service.captureTopUp('user-1', 'top-up-1')).rejects.toThrow(
      new BadRequestException('La recarga no tiene un pago PayPal asociado.'),
    );
    await expect(service.refreshTopUp('user-1', 'top-up-1')).rejects.toThrow(
      new BadRequestException('La recarga no tiene un pago PayPal asociado.'),
    );
  });

  it('captures a top up and returns the refreshed wallet summary', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma as never, provider);
    const topUp = {
      id: 'top-up-1',
      walletId: 'wallet-1',
      provider: PaymentProvider.Paypal,
      status: 'CHECKOUT_READY',
      currencyCode: 'USD',
      amount: decimal(15),
      providerOrderToken: 'order-1',
      providerPaymentLinkId: 'link-1',
      providerPaymentLinkUrl: 'https://paypal.example/checkout',
      providerOrderStatus: 'CREATED',
      providerPaymentStatus: null,
      paidAt: null,
      expiresAt: null,
      updatedAt: new Date('2030-01-01T09:00:00.000Z'),
      createdAt: new Date('2030-01-01T09:00:00.000Z'),
    };
    const paidAt = new Date('2030-01-01T09:30:00.000Z');

    prisma.walletTopUp.findFirst.mockResolvedValue(topUp);
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
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        walletTopUp: {
          findUnique: jest.fn().mockResolvedValue({
            ...topUp,
            wallet: wallet,
          }),
          update: jest.fn().mockResolvedValue({
            ...topUp,
            status: 'PAID',
            providerPaymentLinkId: 'capture-1',
            providerOrderStatus: 'COMPLETED',
            providerPaymentStatus: 'COMPLETED',
            paidAt,
            lastSyncedAt: paidAt,
          }),
        },
        walletLedgerEntry: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(undefined),
        },
        walletAccount: {
          update: jest.fn().mockResolvedValue({
            ...wallet,
            availableBalance: decimal(35),
            heldBalance: decimal(5),
          }),
        },
      }),
    );
    prisma.walletAccount.findUniqueOrThrow.mockResolvedValue({
      ...wallet,
      availableBalance: decimal(35),
      ledgerEntries: [
        {
          id: 'ledger-1',
          type: 'TOP_UP_CAPTURED',
          amount: decimal(15),
          availableBalanceAfter: decimal(35),
          heldBalanceAfter: decimal(5),
          note: 'Recarga PayPal acreditada.',
          createdAt: paidAt,
        },
      ],
      topUps: [
        {
          id: 'top-up-1',
          provider: PaymentProvider.Paypal,
          status: 'PAID',
          currencyCode: 'USD',
          amount: decimal(15),
          providerPaymentLinkUrl: 'https://paypal.example/checkout',
          paidAt,
          expiresAt: null,
          updatedAt: paidAt,
          createdAt: new Date('2030-01-01T09:00:00.000Z'),
        },
      ],
    });

    const response = await service.captureTopUp('user-1', 'top-up-1');

    expect(provider.capturePayment).toHaveBeenCalledWith({
      providerOrderToken: 'order-1',
    });
    expect(response.message).toBe('Recarga acreditada.');
    expect(response.topUp.status).toBe('PAID');
    expect(response.wallet.account.availableBalance).toBe(35);
  });

  it('requires PayPal configuration before syncing a remote top up state', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma as never, provider);

    provider.isConfigured.mockReturnValue(false);
    prisma.walletTopUp.findFirst.mockResolvedValue({
      id: 'top-up-1',
      walletId: 'wallet-1',
      provider: PaymentProvider.Paypal,
      status: 'CHECKOUT_READY',
      currencyCode: 'USD',
      amount: decimal(20),
      providerOrderToken: 'order-1',
      providerPaymentLinkId: 'link-1',
      providerPaymentLinkUrl: 'https://paypal.example/checkout',
      providerOrderStatus: 'CREATED',
      providerPaymentStatus: null,
      paidAt: null,
      expiresAt: null,
      updatedAt: new Date('2030-01-01T09:00:00.000Z'),
      createdAt: new Date('2030-01-01T09:00:00.000Z'),
    });

    await expect(service.refreshTopUp('user-1', 'top-up-1')).rejects.toThrow(
      new ServiceUnavailableException(
        'PayPal aun no esta configurado para consultar recargas.',
      ),
    );
  });
});
