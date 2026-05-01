import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CapturePaymentUseCase } from '../../application/use-cases/capture-payment.use-case';
import { CreatePaymentCheckoutLinkUseCase } from '../../application/use-cases/create-payment-checkout-link.use-case';
import { RefreshPaymentStatusUseCase } from '../../application/use-cases/refresh-payment-status.use-case';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly capturePaymentUseCase: CapturePaymentUseCase,
    private readonly createPaymentCheckoutLinkUseCase: CreatePaymentCheckoutLinkUseCase,
    private readonly refreshPaymentStatusUseCase: RefreshPaymentStatusUseCase,
  ) {}

  @Post(':paymentId/checkout-link')
  @UseGuards(JwtAuthGuard)
  createCheckoutLink(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
  ) {
    return this.createPaymentCheckoutLinkUseCase.execute(currentUser.id, paymentId);
  }

  @Post(':paymentId/refresh-status')
  @UseGuards(JwtAuthGuard)
  refreshStatus(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
  ) {
    return this.refreshPaymentStatusUseCase.execute(currentUser.id, paymentId);
  }

  @Post(':paymentId/capture')
  @UseGuards(JwtAuthGuard)
  capturePayment(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
  ) {
    return this.capturePaymentUseCase.execute(currentUser.id, paymentId);
  }
}
