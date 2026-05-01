import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  TripPaymentStatus,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import type {
  PaymentsRepository,
  RecordPaymentCheckoutInput,
  SyncPaymentStatusInput,
  TripPaymentRecord,
  UpsertAcceptedTripRequestPaymentInput,
} from '../../application/ports/payments.repository';

@Injectable()
export class PrismaPaymentsRepository implements PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPaymentById(paymentId: string): Promise<TripPaymentRecord | null> {
    const payment = await this.prisma.tripPayment.findUnique({
      where: { id: paymentId },
      include: this.paymentInclude(),
    });

    return payment ? this.mapPayment(payment) : null;
  }

  async findPaymentByProviderOrderToken(
    providerOrderToken: string,
  ): Promise<TripPaymentRecord | null> {
    const payment = await this.prisma.tripPayment.findUnique({
      where: { providerOrderToken },
      include: this.paymentInclude(),
    });

    return payment ? this.mapPayment(payment) : null;
  }

  async upsertAcceptedTripRequestPayment(
    input: UpsertAcceptedTripRequestPaymentInput,
  ): Promise<TripPaymentRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      const tripRequest = await transaction.tripRequest.findUnique({
        where: { id: input.tripRequestId },
        include: {
          trip: {
            include: {
              driverMembership: {
                include: {
                  user: true,
                },
              },
            },
          },
          passengerMembership: {
            include: {
              user: true,
            },
          },
          payment: true,
        },
      });

      if (!tripRequest || tripRequest.status !== 'ACCEPTED') {
        return null;
      }

      if (tripRequest.payment) {
        const existingPayment = await transaction.tripPayment.findUnique({
          where: { id: tripRequest.payment.id },
          include: this.paymentInclude(),
        });

        return existingPayment ? this.mapPayment(existingPayment) : null;
      }

      const amount =
        Number.parseFloat(tripRequest.trip.basePriceReference.toString())
        + (tripRequest.trip.detourSurchargeReference
          ? Number.parseFloat(tripRequest.trip.detourSurchargeReference.toString())
          : 0);

      const createdPayment = await transaction.tripPayment.create({
        data: {
          institutionId: tripRequest.trip.institutionId,
          tripId: tripRequest.tripId,
          tripRequestId: tripRequest.id,
          passengerMembershipId: tripRequest.passengerMembershipId,
          driverMembershipId: tripRequest.trip.driverMembershipId,
          provider: PaymentProvider.Paypal,
          status: TripPaymentStatus.Pending,
          currencyCode: input.currencyCode,
          amount,
          merchantOrderReference: `SRP-${tripRequest.id}`,
        },
        include: this.paymentInclude(),
      });

      return this.mapPayment(createdPayment);
    });
  }

  async recordCheckout(input: RecordPaymentCheckoutInput): Promise<TripPaymentRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.tripPayment.update({
        where: { id: input.paymentId },
        data: {
          status: input.status,
          providerOrderToken: input.providerOrderToken,
          providerPaymentLinkId: input.providerPaymentLinkId,
          providerPaymentLinkUrl: input.checkoutUrl,
          providerOrderStatus: input.providerOrderStatus,
          providerPaymentStatus: input.providerPaymentStatus,
          expiresAt: input.expiresAt,
          lastSyncedAt: new Date(),
          failureReason: null,
        },
      });

      await transaction.tripPaymentAttempt.create({
        data: {
          paymentId: input.paymentId,
          provider: PaymentProvider.Paypal,
          status: input.status,
          checkoutUrl: input.checkoutUrl,
          providerOrderToken: input.providerOrderToken,
          providerPaymentLinkId: input.providerPaymentLinkId,
          providerOrderStatus: input.providerOrderStatus,
          providerPaymentStatus: input.providerPaymentStatus,
          requestPayload: input.requestPayload as never,
          responsePayload: input.responsePayload as never,
        },
      });

      const payment = await transaction.tripPayment.findUnique({
        where: { id: input.paymentId },
        include: this.paymentInclude(),
      });

      if (!payment) {
        throw new Error('PAYMENT_NOT_FOUND');
      }

      return this.mapPayment(payment);
    });
  }

  async syncPaymentStatus(input: SyncPaymentStatusInput): Promise<TripPaymentRecord | null> {
    return this.prisma.$transaction(async (transaction) => {
      const currentPayment = await transaction.tripPayment.findUnique({
        where: { id: input.paymentId },
      });

      if (!currentPayment) {
        return null;
      }

      await transaction.tripPayment.update({
        where: { id: input.paymentId },
        data: {
          status: input.status,
          providerOrderStatus: input.providerOrderStatus,
          providerPaymentStatus: input.providerPaymentStatus,
          paidAt:
            input.status === TripPaymentStatus.Paid
              ? input.paidAt ?? currentPayment.paidAt ?? new Date()
              : currentPayment.paidAt,
          expiresAt: input.expiresAt,
          lastSyncedAt: new Date(),
          failureReason:
            input.status === TripPaymentStatus.Failed
            || input.status === TripPaymentStatus.Expired
              ? currentPayment.failureReason ?? input.providerPaymentStatus ?? input.providerOrderStatus
              : null,
        },
      });

      await transaction.tripPaymentAttempt.create({
        data: {
          paymentId: input.paymentId,
          provider: PaymentProvider.Paypal,
          status: input.status,
          checkoutUrl: currentPayment.providerPaymentLinkUrl,
          providerOrderToken: currentPayment.providerOrderToken,
          providerPaymentLinkId: currentPayment.providerPaymentLinkId,
          providerOrderStatus: input.providerOrderStatus,
          providerPaymentStatus: input.providerPaymentStatus,
          responsePayload: input.responsePayload as never,
        },
      });

      const payment = await transaction.tripPayment.findUnique({
        where: { id: input.paymentId },
        include: this.paymentInclude(),
      });

      return payment ? this.mapPayment(payment) : null;
    });
  }

  async markPaymentCancelledByTripRequestId(
    tripRequestId: string,
    failureReason?: string,
  ): Promise<TripPaymentRecord | null> {
    const payment = await this.prisma.tripPayment.findUnique({
      where: { tripRequestId },
    });

    if (!payment) {
      return null;
    }

    if (payment.status === TripPaymentStatus.Paid || payment.status === TripPaymentStatus.Refunded) {
      return this.findPaymentById(payment.id);
    }

    await this.prisma.tripPayment.update({
      where: { id: payment.id },
      data: {
        status: TripPaymentStatus.Cancelled,
        cancelledAt: new Date(),
        failureReason: failureReason ?? 'Pago cancelado por cambio en la solicitud.',
      },
    });

    return this.findPaymentById(payment.id);
  }

  async markPaymentsCancelledByTripId(tripId: string, failureReason?: string): Promise<number> {
    const result = await this.prisma.tripPayment.updateMany({
      where: {
        tripId,
        status: {
          in: [
            TripPaymentStatus.Pending,
            TripPaymentStatus.CheckoutReady,
            TripPaymentStatus.Processing,
            TripPaymentStatus.Failed,
          ],
        },
      },
      data: {
        status: TripPaymentStatus.Cancelled,
        cancelledAt: new Date(),
        failureReason: failureReason ?? 'Pago cancelado porque el viaje fue cancelado.',
      },
    });

    return result.count;
  }

  private paymentInclude() {
    return {
      trip: {
        include: {
          driverMembership: {
            include: {
              user: true,
            },
          },
        },
      },
      passengerMembership: {
        include: {
          user: true,
        },
      },
    } as const;
  }

  private mapPayment(payment: {
    id: string;
    institutionId: string;
    tripId: string;
    tripRequestId: string;
    provider: string;
    status: string;
    currencyCode: string;
    amount: { toString(): string };
    merchantOrderReference: string;
    providerOrderToken: string | null;
    providerPaymentLinkId: string | null;
    providerPaymentLinkUrl: string | null;
    providerOrderStatus: string | null;
    providerPaymentStatus: string | null;
    failureReason: string | null;
    paidAt: Date | null;
    cancelledAt: Date | null;
    expiresAt: Date | null;
    lastSyncedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    trip: {
      originLabel: string;
      destinationLabel: string;
      departureAt: Date;
      status: string;
      driverMembershipId: string;
      driverMembership: {
        userId: string;
        user: { fullName: string };
      };
    };
    passengerMembership: {
      id: string;
      userId: string;
      user: {
        email: string;
        fullName: string;
      };
    };
  }): TripPaymentRecord {
    return {
      id: payment.id,
      institutionId: payment.institutionId,
      tripId: payment.tripId,
      tripRequestId: payment.tripRequestId,
      passengerMembershipId: payment.passengerMembership.id,
      passengerUserId: payment.passengerMembership.userId,
      passengerEmail: payment.passengerMembership.user.email,
      passengerFullName: payment.passengerMembership.user.fullName,
      driverMembershipId: payment.trip.driverMembershipId,
      driverUserId: payment.trip.driverMembership.userId,
      driverFullName: payment.trip.driverMembership.user.fullName,
      tripOriginLabel: payment.trip.originLabel,
      tripDestinationLabel: payment.trip.destinationLabel,
      tripDepartureAt: payment.trip.departureAt,
      tripStatus: payment.trip.status,
      provider: payment.provider as PaymentProvider,
      status: payment.status as TripPaymentStatus,
      currencyCode: payment.currencyCode,
      amount: Number.parseFloat(payment.amount.toString()),
      merchantOrderReference: payment.merchantOrderReference,
      providerOrderToken: payment.providerOrderToken,
      providerPaymentLinkId: payment.providerPaymentLinkId,
      providerPaymentLinkUrl: payment.providerPaymentLinkUrl,
      providerOrderStatus: payment.providerOrderStatus,
      providerPaymentStatus: payment.providerPaymentStatus,
      failureReason: payment.failureReason,
      paidAt: payment.paidAt,
      cancelledAt: payment.cancelledAt,
      expiresAt: payment.expiresAt,
      lastSyncedAt: payment.lastSyncedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
