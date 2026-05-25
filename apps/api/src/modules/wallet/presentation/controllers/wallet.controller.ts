import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { WalletService } from '../../application/services/wallet.service';
import { CreateWalletTopUpRequestDto } from '../dto/create-wallet-top-up.request.dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getWallet(@CurrentUser() currentUser: CurrentUserContext) {
    return this.walletService.getWallet(currentUser.id);
  }

  @Post('top-ups')
  createTopUp(
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: CreateWalletTopUpRequestDto,
  ) {
    return this.walletService.createTopUp(currentUser.id, body.amount);
  }

  @Post('top-ups/:topUpId/capture')
  captureTopUp(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('topUpId') topUpId: string,
  ) {
    return this.walletService.captureTopUp(currentUser.id, topUpId);
  }

  @Post('top-ups/:topUpId/refresh-status')
  refreshTopUp(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('topUpId') topUpId: string,
  ) {
    return this.walletService.refreshTopUp(currentUser.id, topUpId);
  }
}
