import {
  Controller,
  Param,
  Post,
  UseGuards,
  Body,
} from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CapturePaymentUseCase } from '../../application/use-cases/capture-payment.use-case';
import { ConfirmCashPaymentUseCase } from '../../application/use-cases/confirm-cash-payment.use-case';
import { CreatePaymentCheckoutLinkUseCase } from '../../application/use-cases/create-payment-checkout-link.use-case';
import { RefreshPaymentStatusUseCase } from '../../application/use-cases/refresh-payment-status.use-case';
import { ReportCashPaymentIssueUseCase } from '../../application/use-cases/report-cash-payment-issue.use-case';
import { ReportCashPaymentIssueRequestDto } from '../dto/report-cash-payment-issue.request.dto';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly capturePaymentUseCase: CapturePaymentUseCase,
    private readonly createPaymentCheckoutLinkUseCase: CreatePaymentCheckoutLinkUseCase,
    private readonly refreshPaymentStatusUseCase: RefreshPaymentStatusUseCase,
    private readonly confirmCashPaymentUseCase: ConfirmCashPaymentUseCase,
    private readonly reportCashPaymentIssueUseCase: ReportCashPaymentIssueUseCase,
  ) {}

  @Post(':paymentId/checkout-link')
  @UseGuards(JwtAuthGuard)
  createCheckoutLink(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('paymentId') paymentId: string,
  ) {
    return this.createPaymentCheckoutLinkUseCase.execute(currentUser.id, paymentId);
  }

  @Post(':paymentId/refresh-status')
  @UseGuards(JwtAuthGuard)
  refreshStatus(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('paymentId') paymentId: string,
  ) {
    return this.refreshPaymentStatusUseCase.execute(currentUser.id, paymentId);
  }

  @Post(':paymentId/capture')
  @UseGuards(JwtAuthGuard)
  capturePayment(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('paymentId') paymentId: string,
  ) {
    return this.capturePaymentUseCase.execute(currentUser.id, paymentId);
  }

  @Post(':paymentId/confirm-cash')
  @UseGuards(JwtAuthGuard)
  confirmCashPayment(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('paymentId') paymentId: string,
  ) {
    return this.confirmCashPaymentUseCase.execute(currentUser.id, paymentId);
  }

  @Post(':paymentId/report-cash-issue')
  @UseGuards(JwtAuthGuard)
  reportCashPaymentIssue(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('paymentId') paymentId: string,
    @Body() body: ReportCashPaymentIssueRequestDto,
  ) {
    return this.reportCashPaymentIssueUseCase.execute(currentUser.id, paymentId, body.note);
  }
}
