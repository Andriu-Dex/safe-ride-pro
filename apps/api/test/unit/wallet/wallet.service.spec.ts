import { BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, WalletTopUp, WalletTopUpStatus, MembershipRole, DriverVerificationStatus, WalletLedgerEntry } from '@prisma/client';
import { MembershipStatus, PaymentProvider, TripPaymentStatus } from '@saferidepro/shared-types';

import type { PaymentProviderPort } from '../../../src/modules/payments/application/ports/payment-provider';
import { WalletService } from '../../../src/modules/wallet/application/services/wallet.service';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

jest.mock('../../../src/modules/payments/domain/payment-status', () => {
  const actual = jest.requireActual('../../../src/modules/payments/domain/payment-status') as typeof import('../../../src/modules/payments/domain/payment-status');
  return {
    ...actual,
    mapPaypalStatusesToTripPaymentStatus: jest.fn((input: { orderStatus?: string | null; paymentStatus?: string | null }) => {
      if (input.orderStatus === 'MOCK_EXPIRED') {
        return TripPaymentStatus.Expired;
      }
      if (input.orderStatus === 'MOCK_CANCELLED') {
        return TripPaymentStatus.Cancelled;
      }
      return actual.mapPaypalStatusesToTripPaymentStatus(input);
    }),
  };
});

function buildWalletTopUp(overrides: Partial<WalletTopUp> = {}): WalletTopUp {
  return {
    id: 'top-up-1',
    walletId: 'wallet-1',
    provider: PaymentProvider.Paypal,
    status: 'PENDING',
    currencyCode: 'USD',
    amount: new Prisma.Decimal(15),
    merchantOrderReference: 'SRP-WALLET-123',
    providerOrderToken: 'order-1',
    providerPaymentLinkId: 'link-1',
    providerPaymentLinkUrl: 'https://paypal.example/checkout',
    providerOrderStatus: 'CREATED',
    providerPaymentStatus: null,
    paidAt: null,
    expiresAt: null,
    lastSyncedAt: null,
    failureReason: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as WalletTopUp;
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function createPrismaMock(): jest.Mocked<PrismaService> {
  return {
    userInstitutionMembership: {
      findFirst: jest.fn(),
    },
    walletAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    walletTopUp: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    walletLedgerEntry: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as jest.Mocked<PrismaService>;
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
  createdAt: new Date('2030-01-01T09:00:00.000Z'),
  updatedAt: new Date('2030-01-01T09:00:00.000Z'),
  role: MembershipRole.STUDENT,
  studentCode: 'STUDENT-001',
  driverVerificationStatus: DriverVerificationStatus.NOT_REQUESTED,
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
  createdAt: new Date('2030-01-01T09:00:00.000Z'),
  updatedAt: new Date('2030-01-01T09:00:00.000Z'),
};

type WalletAccountWithRelations = Prisma.WalletAccountGetPayload<{
  include: {
    ledgerEntries: true;
    topUps: true;
  };
}>;

type WalletTopUpWithRelations = Prisma.WalletTopUpGetPayload<{
  include: {
    wallet: {
      include: {
        membership: {
          include: {
            user: true;
          };
        };
      };
    };
  };
}>;

function buildWalletLedgerEntry(overrides: Partial<WalletLedgerEntry> = {}): WalletLedgerEntry {
  return {
    id: 'ledger-1',
    walletId: 'wallet-1',
    type: 'TOP_UP_CAPTURED',
    amount: decimal(10),
    availableBalanceAfter: decimal(10),
    heldBalanceAfter: decimal(0),
    topUpId: 'top-up-1',
    tripPaymentId: null,
    note: 'Recarga PayPal acreditada.',
    metadata: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildWalletAccountWithRelations(overrides: Partial<WalletAccountWithRelations> = {}): WalletAccountWithRelations {
  return {
    ...wallet,
    ledgerEntries: [],
    topUps: [],
    ...overrides,
  } as WalletAccountWithRelations;
}

function buildWalletTopUpWithRelations(overrides: Partial<WalletTopUpWithRelations> = {}): WalletTopUpWithRelations {
  return {
    ...buildWalletTopUp(),
    wallet: {
      ...wallet,
      membership: {
        ...membership,
      },
    },
    ...overrides,
  } as WalletTopUpWithRelations;
}

describe('WalletService', () => {
  it('returns the wallet summary and creates a wallet when the membership has none', async () => {
    const prisma = createPrismaMock();
    const service = new WalletService(prisma);
    const createdWallet = { ...wallet, availableBalance: decimal(0), heldBalance: decimal(0) };

    jest.mocked(prisma.userInstitutionMembership.findFirst).mockResolvedValue(membership);
    jest.mocked(prisma.walletAccount.findUnique).mockResolvedValue(null);
    jest.mocked(prisma.walletAccount.create).mockResolvedValue(createdWallet);
    jest.mocked(prisma.walletAccount.findUniqueOrThrow).mockResolvedValue(buildWalletAccountWithRelations({
      ...createdWallet,
      ledgerEntries: [
        buildWalletLedgerEntry({
          amount: decimal(10),
          availableBalanceAfter: decimal(10),
          heldBalanceAfter: decimal(0),
          createdAt: new Date('2030-01-01T09:30:00.000Z'),
        }),
      ],
      topUps: [
        buildWalletTopUp({
          id: 'top-up-1',
          amount: decimal(10),
          status: 'PAID',
          providerPaymentLinkUrl: null,
          paidAt: new Date('2030-01-01T09:30:00.000Z'),
          updatedAt: new Date('2030-01-01T09:30:00.000Z'),
          createdAt: new Date('2030-01-01T09:20:00.000Z'),
        }),
      ],
    }));

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
    const service = new WalletService(prisma, provider);

    provider.isConfigured.mockReturnValue(false);

    await expect(service.createTopUp('user-1', 10)).rejects.toThrow(
      new ServiceUnavailableException('PayPal aun no esta configurado para recargas.'),
    );
    expect(prisma.userInstitutionMembership.findFirst).not.toHaveBeenCalled();
  });

  it('validates top up amount limits before creating the provider checkout', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma, provider);

    jest.mocked(prisma.userInstitutionMembership.findFirst).mockResolvedValue(membership);
    jest.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet);

    await expect(service.createTopUp('user-1', 250)).rejects.toThrow(
      new BadRequestException('El monto de recarga debe estar entre $1 y $200.'),
    );

    expect(prisma.walletTopUp.create).not.toHaveBeenCalled();
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it('creates a PayPal checkout for a wallet top up', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma, provider);
    const createdAt = new Date('2030-01-01T09:00:00.000Z');
    const expiresAt = new Date('2030-01-01T09:30:00.000Z');

    jest.mocked(prisma.userInstitutionMembership.findFirst).mockResolvedValue(membership);
    jest.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet);
    jest.mocked(prisma.walletTopUp.create).mockResolvedValue(buildWalletTopUpWithRelations({
      amount: decimal(15),
      createdAt,
      updatedAt: createdAt,
    }));
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
    jest.mocked(prisma.walletTopUp.update).mockResolvedValue(buildWalletTopUp({
      status: 'CHECKOUT_READY',
      amount: decimal(15),
      providerPaymentLinkUrl: 'https://paypal.example/checkout',
      expiresAt,
      updatedAt: createdAt,
      createdAt,
    }));

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
    const service = new WalletService(prisma, provider);
    const paidAt = new Date('2030-01-01T09:30:00.000Z');

    jest.mocked(prisma.walletTopUp.findFirst).mockResolvedValue(buildWalletTopUp({
      status: 'PAID',
      amount: decimal(20),
      providerOrderToken: 'order-1',
      providerPaymentLinkId: 'capture-1',
      providerPaymentLinkUrl: 'https://paypal.example/checkout',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
      paidAt,
      updatedAt: paidAt,
      createdAt: new Date('2030-01-01T09:00:00.000Z'),
    }));
    jest.mocked(prisma.walletAccount.findUniqueOrThrow).mockResolvedValue(buildWalletAccountWithRelations({
      topUps: [
        buildWalletTopUp({
          status: 'PAID',
          amount: decimal(20),
          providerPaymentLinkUrl: 'https://paypal.example/checkout',
          paidAt,
          updatedAt: paidAt,
          createdAt: new Date('2030-01-01T09:00:00.000Z'),
        }),
      ],
    }));

    const response = await service.captureTopUp('user-1', 'top-up-1');

    expect(provider.capturePayment).not.toHaveBeenCalled();
    expect(response.message).toBe('Recarga acreditada.');
    expect(response.wallet.account.availableBalance).toBe(20);
  });

  it('requires an associated PayPal order before capturing or refreshing a top up', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma, provider);
    const topUp = buildWalletTopUp({
      status: 'CHECKOUT_READY',
      amount: decimal(20),
      providerOrderToken: null,
      providerPaymentLinkId: null,
      providerPaymentLinkUrl: null,
      providerOrderStatus: 'CREATED',
      providerPaymentStatus: null,
      updatedAt: new Date('2030-01-01T09:00:00.000Z'),
      createdAt: new Date('2030-01-01T09:00:00.000Z'),
    });

    jest.mocked(prisma.walletTopUp.findFirst).mockResolvedValue(topUp);

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
    const service = new WalletService(prisma, provider);
    const topUp = buildWalletTopUp({
      status: 'CHECKOUT_READY',
      amount: decimal(15),
      providerOrderToken: 'order-1',
      providerPaymentLinkId: 'link-1',
      providerPaymentLinkUrl: 'https://paypal.example/checkout',
      providerOrderStatus: 'CREATED',
      providerPaymentStatus: null,
      updatedAt: new Date('2030-01-01T09:00:00.000Z'),
      createdAt: new Date('2030-01-01T09:00:00.000Z'),
    });
    const paidAt = new Date('2030-01-01T09:30:00.000Z');

    jest.mocked(prisma.walletTopUp.findFirst).mockResolvedValue(topUp);
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
    jest.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        walletTopUp: {
          findUnique: jest.fn().mockResolvedValue({
            ...topUp,
            wallet: wallet,
          }),
          update: jest.fn().mockResolvedValue(buildWalletTopUp({
            status: 'PAID',
            amount: decimal(15),
            providerPaymentLinkId: 'capture-1',
            providerOrderStatus: 'COMPLETED',
            providerPaymentStatus: 'COMPLETED',
            paidAt,
            lastSyncedAt: paidAt,
          })),
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
      } as unknown as Prisma.TransactionClient),
    );
    jest.mocked(prisma.walletAccount.findUniqueOrThrow).mockResolvedValue(buildWalletAccountWithRelations({
      availableBalance: decimal(35),
      ledgerEntries: [
        buildWalletLedgerEntry({
          amount: decimal(15),
          availableBalanceAfter: decimal(35),
          heldBalanceAfter: decimal(5),
          createdAt: paidAt,
        }),
      ],
      topUps: [
        buildWalletTopUp({
          status: 'PAID',
          amount: decimal(15),
          providerPaymentLinkUrl: 'https://paypal.example/checkout',
          paidAt,
          updatedAt: paidAt,
          createdAt: new Date('2030-01-01T09:00:00.000Z'),
        }),
      ],
    }));

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
    const service = new WalletService(prisma, provider);

    provider.isConfigured.mockReturnValue(false);
    jest.mocked(prisma.walletTopUp.findFirst).mockResolvedValue(buildWalletTopUp({
      status: 'CHECKOUT_READY',
      amount: decimal(20),
      providerOrderToken: 'order-1',
      providerPaymentLinkId: 'link-1',
      providerPaymentLinkUrl: 'https://paypal.example/checkout',
      providerOrderStatus: 'CREATED',
      providerPaymentStatus: null,
      updatedAt: new Date('2030-01-01T09:00:00.000Z'),
      createdAt: new Date('2030-01-01T09:00:00.000Z'),
    }));

    await expect(service.refreshTopUp('user-1', 'top-up-1')).rejects.toThrow(
      new ServiceUnavailableException(
        'PayPal aun no esta configurado para consultar recargas.',
      ),
    );
  });

  it('blocks capture when PayPal is not configured', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma, provider);

    provider.isConfigured.mockReturnValue(false);
    jest.mocked(prisma.walletTopUp.findFirst).mockResolvedValue(buildWalletTopUp({
      status: 'CHECKOUT_READY',
    }));

    await expect(service.captureTopUp('user-1', 'top-up-1')).rejects.toThrow(
      new ServiceUnavailableException(
        'PayPal aun no esta configurado para confirmar recargas.',
      ),
    );
  });

  it('refreshes a top up and syncs it', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma, provider);
    const date = new Date();

    jest.mocked(prisma.walletTopUp.findFirst).mockResolvedValue(buildWalletTopUp({
      status: 'CHECKOUT_READY',
    }));

    provider.fetchPaymentStatus.mockResolvedValue({
      provider: PaymentProvider.Paypal,
      providerOrderToken: 'order-1',
      providerCaptureId: 'capture-1',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
      paidAt: date,
      expiresAt: null,
      rawResponse: { id: 'capture-1' },
    });

    jest.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        walletTopUp: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'top-up-1',
            walletId: 'wallet-1',
            status: 'CHECKOUT_READY',
            amount: decimal(15),
            wallet: wallet,
          }),
          update: jest.fn().mockResolvedValue(buildWalletTopUp({
            id: 'top-up-1',
            status: 'PAID',
            amount: decimal(15),
            providerPaymentLinkUrl: 'https://paypal.example',
            paidAt: date,
            updatedAt: date,
            createdAt: date,
          })),
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
      } as unknown as Prisma.TransactionClient),
    );

    jest.mocked(prisma.walletAccount.findUniqueOrThrow).mockResolvedValue(buildWalletAccountWithRelations({
      availableBalance: decimal(35),
    }));

    const response = await service.refreshTopUp('user-1', 'top-up-1');
    expect(response.message).toBe('Recarga acreditada.');
  });

  it('throws NotFoundException if topUpId does not exist in transaction', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma, provider);

    jest.mocked(prisma.walletTopUp.findFirst).mockResolvedValue(buildWalletTopUp({
      status: 'CHECKOUT_READY',
    }));

    provider.capturePayment.mockResolvedValue({
      provider: PaymentProvider.Paypal,
      providerOrderToken: 'order-1',
      providerCaptureId: 'capture-1',
      providerOrderStatus: 'COMPLETED',
      providerPaymentStatus: 'COMPLETED',
      paidAt: new Date(),
      expiresAt: null,
      rawResponse: {},
    });

    jest.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        walletTopUp: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      } as unknown as Prisma.TransactionClient),
    );

    await expect(service.captureTopUp('user-1', 'top-up-1')).rejects.toThrow(
      new NotFoundException('La recarga no existe.'),
    );
  });

  it('throws ForbiddenException if user has no active membership', async () => {
    const prisma = createPrismaMock();
    const service = new WalletService(prisma);

    jest.mocked(prisma.userInstitutionMembership.findFirst).mockResolvedValue(null);

    await expect(service.getWallet('user-1')).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para usar la billetera.'),
    );
  });

  it('handles unique constraint error in ensureWallet and falls back to findUniqueOrThrow', async () => {
    const prisma = createPrismaMock();
    const service = new WalletService(prisma);

    jest.mocked(prisma.userInstitutionMembership.findFirst).mockResolvedValue(membership);
    jest.mocked(prisma.walletAccount.findUnique).mockResolvedValue(null);

    // Mock create to throw unique constraint error
    const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '1.0',
        meta: { target: ['membershipId'] },
      },
    );
    jest.mocked(prisma.walletAccount.create).mockRejectedValue(uniqueConstraintError);
    jest.mocked(prisma.walletAccount.findUniqueOrThrow).mockResolvedValue(buildWalletAccountWithRelations());

    const result = await service.getWallet('user-1');
    expect(result.account.id).toBe('wallet-1');
  });

  it('rethrows other errors in ensureWallet', async () => {
    const prisma = createPrismaMock();
    const service = new WalletService(prisma);

    jest.mocked(prisma.userInstitutionMembership.findFirst).mockResolvedValue(membership);
    jest.mocked(prisma.walletAccount.findUnique).mockResolvedValue(null);
    jest.mocked(prisma.walletAccount.create).mockRejectedValue(new Error('Random DB error'));

    await expect(service.getWallet('user-1')).rejects.toThrow('Random DB error');
  });

  it('throws NotFoundException if top up is not found for user', async () => {
    const prisma = createPrismaMock();
    const service = new WalletService(prisma);

    jest.mocked(prisma.walletTopUp.findFirst).mockResolvedValue(null);

    await expect(service.captureTopUp('user-1', 'top-up-1')).rejects.toThrow(
      new NotFoundException('La recarga no existe.'),
    );
  });

  it('exercises all cases of mapWalletTopUpStatus helper', async () => {
    const prisma = createPrismaMock();
    const provider = createPaymentProviderMock();
    const service = new WalletService(prisma, provider);

    jest.mocked(prisma.userInstitutionMembership.findFirst).mockResolvedValue(membership);
    jest.mocked(prisma.walletAccount.findUnique).mockResolvedValue(wallet);

    const testCases = [
      { orderStatus: 'COMPLETED', paymentStatus: 'COMPLETED', expectedTopUpStatus: 'PAID' },
      { orderStatus: 'PROCESSING', paymentStatus: 'PENDING', expectedTopUpStatus: 'PROCESSING' },
      { orderStatus: 'VOIDED', paymentStatus: 'FAILED', expectedTopUpStatus: 'FAILED' },
      { orderStatus: 'MOCK_EXPIRED', paymentStatus: '', expectedTopUpStatus: 'EXPIRED' },
      { orderStatus: 'MOCK_CANCELLED', paymentStatus: '', expectedTopUpStatus: 'CANCELLED' },
      { orderStatus: 'CREATED', paymentStatus: '', expectedTopUpStatus: 'CHECKOUT_READY' },
      { orderStatus: 'REFUNDED', paymentStatus: 'REFUNDED', expectedTopUpStatus: 'PENDING' }, // triggers Refunded -> default: PENDING
    ];

    for (const { orderStatus, paymentStatus, expectedTopUpStatus } of testCases) {
      jest.mocked(prisma.walletTopUp.create).mockResolvedValue(buildWalletTopUpWithRelations({
        amount: decimal(15),
      }));
      provider.createCheckout.mockResolvedValue({
        provider: PaymentProvider.Paypal,
        checkoutUrl: 'https://paypal.example/checkout',
        providerOrderToken: 'order-1',
        providerPaymentLinkId: 'link-1',
        providerOrderStatus: orderStatus,
        providerPaymentStatus: paymentStatus,
        expiresAt: new Date(),
        rawResponse: {},
      });
      jest.mocked(prisma.walletTopUp.update).mockResolvedValue(buildWalletTopUp({
        status: expectedTopUpStatus as WalletTopUpStatus,
      }));

      const res = await service.createTopUp('user-1', 15);
      expect(res.topUp.status).toBe(expectedTopUpStatus);
    }
  });
});
