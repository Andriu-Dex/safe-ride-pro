import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AppNotificationType, PaymentProvider } from '@saferidepro/shared-types';

import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import {
  PAYMENTS_REPOSITORY,
  PaymentsRepository,
} from '../ports/payments.repository';

@Injectable()
export class ReportCashPaymentIssueUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY)
    private readonly paymentsRepository: PaymentsRepository,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  async execute(userId: string, paymentId: string, note: string) {
    const payment = await this.paymentsRepository.findPaymentById(paymentId);
    const failureReason = note.trim();

    if (!payment) {
      throw new NotFoundException('El pago no existe.');
    }

    if (payment.driverUserId !== userId) {
      throw new ForbiddenException('Solo el conductor puede reportar este pago.');
    }

    if (payment.provider !== PaymentProvider.Cash) {
      throw new BadRequestException('Este pago no corresponde a efectivo.');
    }

    if (failureReason.length < 10) {
      throw new BadRequestException('Describe brevemente la novedad del pago.');
    }

    const updatedPayment = await this.paymentsRepository.markCashPaymentFailed(
      paymentId,
      failureReason,
    );

    if (!updatedPayment) {
      throw new BadRequestException('No se pudo reportar la novedad.');
    }

    await this.notificationsService?.notifyMembership({
      institutionId: updatedPayment.institutionId,
      recipientMembershipId: updatedPayment.passengerMembershipId,
      actorUserId: userId,
      type: AppNotificationType.CashPaymentReported,
      title: 'Novedad de pago reportada',
      body: 'El conductor reporto una novedad con el pago en efectivo.',
      actionUrl: '/confianza',
    });

    return {
      message: 'Novedad de pago registrada.',
      payment: updatedPayment,
    };
  }
}
