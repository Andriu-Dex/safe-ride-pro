import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MembershipStatus,
  PaymentProvider,
  TripPaymentStatus,
} from '@saferidepro/shared-types';
import { randomUUID } from 'node:crypto';

import { getAppEnvironment } from '../../../../shared/infrastructure/config/app-environment';
import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  PAYMENT_PROVIDER,
  PaymentProviderPort,
} from '../../../payments/application/ports/payment-provider';
import { mapPaypalStatusesToTripPaymentStatus } from '../../../payments/domain/payment-status';

type WalletTopUpStatus =
  | 'PENDING'
  | 'CHECKOUT_READY'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider?: PaymentProviderPort,
  ) {}

  async getWallet(userId: string) {
    const membership = await this.findOperationalMembership(userId);
    const wallet = await this.ensureWallet(
      membership.id,
      membership.institutionId,
      getAppEnvironment().paymentsCurrency,
    );

    return this.buildWalletResponse(wallet.id);
  }

  async createTopUp(userId: string, amount: number) {
    if (!this.paymentProvider?.isConfigured()) {
      throw new ServiceUnavailableException(
        'PayPal aun no esta configurado para recargas.',
      );
    }

    const membership = await this.findOperationalMembership(userId);
    const wallet = await this.ensureWallet(
      membership.id,
      membership.institutionId,
      getAppEnvironment().paymentsCurrency,
    );
    const normalizedAmount = normalizeAmount(amount);

    const topUp = await this.prisma.walletTopUp.create({
      data: {
        walletId: wallet.id,
        provider: PaymentProvider.Paypal,
        status: 'PENDING',
        currencyCode: wallet.currencyCode,
        amount: normalizedAmount,
        merchantOrderReference: `SRP-WALLET-${randomUUID()}`,
      },
      include: {
        wallet: {
          include: {
            membership: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    const checkout = await this.paymentProvider.createCheckout({
      paymentId: topUp.id,
      merchantOrderReference: topUp.merchantOrderReference,
      amount: normalizedAmount,
      currencyCode: topUp.currencyCode,
      passengerEmail: topUp.wallet.membership.user.email,
      passengerFullName: topUp.wallet.membership.user.fullName,
      tripOriginLabel: 'Billetera',
      tripDestinationLabel: 'SafeRidePro',
      tripDepartureAt: new Date(),
      description: 'Recarga de billetera SafeRidePro',
      successPath: '/billetera',
      cancelPath: '/billetera',
      successParams: {
        topUpId: topUp.id,
        topUpProvider: 'paypal',
      },
      cancelParams: {
        topUpId: topUp.id,
        topUpProvider: 'paypal',
        topUpResult: 'cancel',
      },
    });

    const updatedTopUp = await this.prisma.walletTopUp.update({
      where: { id: topUp.id },
      data: {
        status: mapWalletTopUpStatus(
          mapPaypalStatusesToTripPaymentStatus({
            orderStatus: checkout.providerOrderStatus,
            paymentStatus: checkout.providerPaymentStatus,
          }),
        ),
        providerOrderToken: checkout.providerOrderToken,
        providerPaymentLinkId: checkout.providerPaymentLinkId,
        providerPaymentLinkUrl: checkout.checkoutUrl,
        providerOrderStatus: checkout.providerOrderStatus,
        providerPaymentStatus: checkout.providerPaymentStatus,
        expiresAt: checkout.expiresAt,
        lastSyncedAt: new Date(),
      },
    });

    return {
      message: 'Recarga creada.',
      topUp: this.mapTopUp(updatedTopUp),
      checkoutUrl: checkout.checkoutUrl,
    };
  }

  async captureTopUp(userId: string, topUpId: string) {
    const topUp = await this.findTopUpForUser(userId, topUpId);

    if (topUp.status === 'PAID') {
      return {
        message: 'Recarga acreditada.',
        topUp: this.mapTopUp(topUp),
        wallet: await this.buildWalletResponse(topUp.walletId),
      };
    }

    if (!topUp.providerOrderToken) {
      throw new BadRequestException('La recarga no tiene un pago PayPal asociado.');
    }

    if (!this.paymentProvider?.isConfigured()) {
      throw new ServiceUnavailableException(
        'PayPal aun no esta configurado para confirmar recargas.',
      );
    }

    const capture = await this.paymentProvider.capturePayment({
      providerOrderToken: topUp.providerOrderToken,
    });
    const status = mapWalletTopUpStatus(
      mapPaypalStatusesToTripPaymentStatus({
        orderStatus: capture.providerOrderStatus,
        paymentStatus: capture.providerPaymentStatus,
      }),
    );
    const updatedTopUp = await this.syncTopUpStatus(topUp.id, {
      status,
      providerPaymentLinkId: capture.providerCaptureId,
      providerOrderStatus: capture.providerOrderStatus,
      providerPaymentStatus: capture.providerPaymentStatus,
      paidAt: capture.paidAt,
      expiresAt: capture.expiresAt,
      responsePayload: capture.rawResponse,
    });

    return {
      message: status === 'PAID' ? 'Recarga acreditada.' : 'Recarga actualizada.',
      topUp: this.mapTopUp(updatedTopUp),
      wallet: await this.buildWalletResponse(topUp.walletId),
    };
  }

  async refreshTopUp(userId: string, topUpId: string) {
    const topUp = await this.findTopUpForUser(userId, topUpId);

    if (!topUp.providerOrderToken) {
      throw new BadRequestException('La recarga no tiene un pago PayPal asociado.');
    }

    if (!this.paymentProvider?.isConfigured()) {
      throw new ServiceUnavailableException(
        'PayPal aun no esta configurado para consultar recargas.',
      );
    }

    const statusResult = await this.paymentProvider.fetchPaymentStatus({
      providerOrderToken: topUp.providerOrderToken,
    });
    const status = mapWalletTopUpStatus(
      mapPaypalStatusesToTripPaymentStatus({
        orderStatus: statusResult.providerOrderStatus,
        paymentStatus: statusResult.providerPaymentStatus,
      }),
    );
    const updatedTopUp = await this.syncTopUpStatus(topUp.id, {
      status,
      providerPaymentLinkId: statusResult.providerCaptureId,
      providerOrderStatus: statusResult.providerOrderStatus,
      providerPaymentStatus: statusResult.providerPaymentStatus,
      paidAt: statusResult.paidAt,
      expiresAt: statusResult.expiresAt,
      responsePayload: statusResult.rawResponse,
    });

    return {
      message: status === 'PAID' ? 'Recarga acreditada.' : 'Recarga actualizada.',
      topUp: this.mapTopUp(updatedTopUp),
      wallet: await this.buildWalletResponse(topUp.walletId),
    };
  }

  private async syncTopUpStatus(
    topUpId: string,
    input: {
      status: WalletTopUpStatus;
      providerPaymentLinkId: string | null;
      providerOrderStatus: string | null;
      providerPaymentStatus: string | null;
      paidAt: Date | null;
      expiresAt: Date | null;
      responsePayload: unknown;
    },
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const currentTopUp = await transaction.walletTopUp.findUnique({
        where: { id: topUpId },
        include: { wallet: true },
      });

      if (!currentTopUp) {
        throw new NotFoundException('La recarga no existe.');
      }

      const alreadyCredited = await transaction.walletLedgerEntry.findFirst({
        where: {
          topUpId,
          type: 'TOP_UP_CAPTURED',
        },
      });

      if (input.status === 'PAID' && currentTopUp.status !== 'PAID' && !alreadyCredited) {
        const amount = Number.parseFloat(currentTopUp.amount.toString());
        const updatedWallet = await transaction.walletAccount.update({
          where: { id: currentTopUp.walletId },
          data: {
            availableBalance: {
              increment: amount,
            },
          },
        });

        await transaction.walletLedgerEntry.create({
          data: {
            walletId: currentTopUp.walletId,
            type: 'TOP_UP_CAPTURED',
            amount,
            availableBalanceAfter: updatedWallet.availableBalance,
            heldBalanceAfter: updatedWallet.heldBalance,
            topUpId,
            note: 'Recarga PayPal acreditada.',
            metadata: input.responsePayload as never,
          },
        });
      }

      return transaction.walletTopUp.update({
        where: { id: topUpId },
        data: {
          status: input.status,
          providerPaymentLinkId:
            input.providerPaymentLinkId === undefined
              ? currentTopUp.providerPaymentLinkId
              : input.providerPaymentLinkId,
          providerOrderStatus: input.providerOrderStatus,
          providerPaymentStatus: input.providerPaymentStatus,
          paidAt:
            input.status === 'PAID'
              ? input.paidAt ?? currentTopUp.paidAt ?? new Date()
              : currentTopUp.paidAt,
          expiresAt: input.expiresAt,
          lastSyncedAt: new Date(),
          failureReason:
            input.status === 'FAILED' || input.status === 'EXPIRED'
              ? input.providerPaymentStatus ?? input.providerOrderStatus
              : null,
        },
      });
    });
  }

  private async findOperationalMembership(userId: string) {
    const membership = await this.prisma.userInstitutionMembership.findFirst({
      where: {
        userId,
        membershipStatus: MembershipStatus.Active,
        institution: {
          isActive: true,
        },
      },
      include: {
        user: true,
      },
      orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
    });

    if (!membership) {
      throw new ForbiddenException('No tienes una membresia activa para usar la billetera.');
    }

    return membership;
  }

  private async ensureWallet(membershipId: string, institutionId: string, currencyCode: string) {
    const existingWallet = await this.prisma.walletAccount.findUnique({
      where: { membershipId },
    });

    if (existingWallet) {
      return existingWallet;
    }

    try {
      return await this.prisma.walletAccount.create({
        data: {
          membershipId,
          institutionId,
          currencyCode,
        },
      });
    } catch (error) {
      if (isMembershipUniqueConstraintError(error)) {
        return this.prisma.walletAccount.findUniqueOrThrow({
          where: { membershipId },
        });
      }

      throw error;
    }
  }

  private async findTopUpForUser(userId: string, topUpId: string) {
    const topUp = await this.prisma.walletTopUp.findFirst({
      where: {
        id: topUpId,
        wallet: {
          membership: {
            userId,
          },
        },
      },
    });

    if (!topUp) {
      throw new NotFoundException('La recarga no existe.');
    }

    return topUp;
  }

  private async buildWalletResponse(walletId: string) {
    const wallet = await this.prisma.walletAccount.findUniqueOrThrow({
      where: { id: walletId },
      include: {
        ledgerEntries: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
        topUps: {
          orderBy: { createdAt: 'desc' },
          take: 8,
        },
      },
    });

    return {
      account: {
        id: wallet.id,
        currencyCode: wallet.currencyCode,
        availableBalance: Number.parseFloat(wallet.availableBalance.toString()),
        heldBalance: Number.parseFloat(wallet.heldBalance.toString()),
        updatedAt: wallet.updatedAt,
      },
      movements: wallet.ledgerEntries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        amount: Number.parseFloat(entry.amount.toString()),
        availableBalanceAfter: Number.parseFloat(entry.availableBalanceAfter.toString()),
        heldBalanceAfter: Number.parseFloat(entry.heldBalanceAfter.toString()),
        note: entry.note,
        createdAt: entry.createdAt,
      })),
      topUps: wallet.topUps.map((topUp) => this.mapTopUp(topUp)),
    };
  }

  private mapTopUp(topUp: {
    id: string;
    provider: string;
    status: string;
    currencyCode: string;
    amount: { toString(): string };
    providerPaymentLinkUrl: string | null;
    paidAt: Date | null;
    expiresAt: Date | null;
    updatedAt: Date;
    createdAt: Date;
  }) {
    return {
      id: topUp.id,
      provider: topUp.provider,
      status: topUp.status,
      currencyCode: topUp.currencyCode,
      amount: Number.parseFloat(topUp.amount.toString()),
      checkoutUrl: topUp.providerPaymentLinkUrl,
      paidAt: topUp.paidAt,
      expiresAt: topUp.expiresAt,
      updatedAt: topUp.updatedAt,
      createdAt: topUp.createdAt,
    };
  }
}

function normalizeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount < 1 || amount > 200) {
    throw new BadRequestException('El monto de recarga debe estar entre $1 y $200.');
  }

  return Number.parseFloat(amount.toFixed(2));
}

function mapWalletTopUpStatus(status: TripPaymentStatus): WalletTopUpStatus {
  switch (status) {
    case TripPaymentStatus.Paid:
      return 'PAID';
    case TripPaymentStatus.Processing:
      return 'PROCESSING';
    case TripPaymentStatus.Failed:
      return 'FAILED';
    case TripPaymentStatus.Expired:
      return 'EXPIRED';
    case TripPaymentStatus.Cancelled:
      return 'CANCELLED';
    case TripPaymentStatus.CheckoutReady:
      return 'CHECKOUT_READY';
    default:
      return 'PENDING';
  }
}

function isMembershipUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes('membershipId')
  );
}
