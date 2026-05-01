import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PAYMENT_PROVIDER } from './application/ports/payment-provider';
import { PAYMENTS_REPOSITORY } from './application/ports/payments.repository';
import { TripPaymentsOrchestratorService } from './application/services/trip-payments-orchestrator.service';
import { CapturePaymentUseCase } from './application/use-cases/capture-payment.use-case';
import { CreatePaymentCheckoutLinkUseCase } from './application/use-cases/create-payment-checkout-link.use-case';
import { RefreshPaymentStatusUseCase } from './application/use-cases/refresh-payment-status.use-case';
import { PaypalPaymentProvider } from './infrastructure/providers/paypal-payment-provider';
import { PrismaPaymentsRepository } from './infrastructure/repositories/prisma-payments.repository';
import { PaymentsController } from './presentation/controllers/payments.controller';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [
    {
      provide: PAYMENTS_REPOSITORY,
      useClass: PrismaPaymentsRepository,
    },
    {
      provide: PAYMENT_PROVIDER,
      useClass: PaypalPaymentProvider,
    },
    TripPaymentsOrchestratorService,
    CapturePaymentUseCase,
    CreatePaymentCheckoutLinkUseCase,
    RefreshPaymentStatusUseCase,
  ],
  exports: [TripPaymentsOrchestratorService],
})
export class PaymentsModule {}
