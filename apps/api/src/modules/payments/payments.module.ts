import { Global, Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { PAYMENT_PROVIDER } from './application/ports/payment-provider';
import { PAYMENTS_REPOSITORY } from './application/ports/payments.repository';
import { TripPaymentsOrchestratorService } from './application/services/trip-payments-orchestrator.service';
import { CapturePaymentUseCase } from './application/use-cases/capture-payment.use-case';
import { ConfirmCashPaymentUseCase } from './application/use-cases/confirm-cash-payment.use-case';
import { CreatePaymentCheckoutLinkUseCase } from './application/use-cases/create-payment-checkout-link.use-case';
import { RefreshPaymentStatusUseCase } from './application/use-cases/refresh-payment-status.use-case';
import { ReportCashPaymentIssueUseCase } from './application/use-cases/report-cash-payment-issue.use-case';
import { PaypalPaymentProvider } from './infrastructure/providers/paypal-payment-provider';
import { PrismaPaymentsRepository } from './infrastructure/repositories/prisma-payments.repository';
import { PaymentsController } from './presentation/controllers/payments.controller';

@Global()
@Module({
  imports: [AuthModule, RealtimeModule],
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
    ConfirmCashPaymentUseCase,
    CreatePaymentCheckoutLinkUseCase,
    RefreshPaymentStatusUseCase,
    ReportCashPaymentIssueUseCase,
  ],
  exports: [TripPaymentsOrchestratorService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
