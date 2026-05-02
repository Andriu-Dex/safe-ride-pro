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
export class ConfirmCashPaymentUseCase {
  constructor(
    @Inject(PAYMENTS_REPOSITORY)
    private readonly paymentsRepository: PaymentsRepository,
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  async execute(userId: string, paymentId: string) {
    const payment = await this.paymentsRepository.findPaymentById(paymentId);

    if (!payment) {
      throw new NotFoundException('El pago no existe.');
    }

    if (payment.driverUserId !== userId) {
      throw new ForbiddenException('Solo el conductor puede confirmar este pago.');
    }

    if (payment.provider !== PaymentProvider.Cash) {
      throw new BadRequestException('Este pago no corresponde a efectivo.');
    }

    const updatedPayment = await this.paymentsRepository.markCashPaymentPaid(paymentId);

    if (!updatedPayment) {
      throw new BadRequestException('No se pudo confirmar el pago.');
    }

    await this.notificationsService?.notifyMembership({
      institutionId: updatedPayment.institutionId,
      recipientMembershipId: updatedPayment.passengerMembershipId,
      actorUserId: userId,
      type: AppNotificationType.PaymentConfirmed,
      title: 'Pago confirmado',
      body: 'El conductor marco el pago en efectivo como recibido.',
      actionUrl: '/viajes',
    });

    return {
      message: 'Pago en efectivo confirmado.',
      payment: updatedPayment,
    };
  }
}
