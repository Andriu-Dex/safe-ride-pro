import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { WalletService } from './application/services/wallet.service';
import { WalletController } from './presentation/controllers/wallet.controller';

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
