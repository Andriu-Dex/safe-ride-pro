import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { DRIVERS_REPOSITORY } from './application/ports/drivers.repository';
import { GetCurrentDriverProfileUseCase } from './application/use-cases/get-current-driver-profile.use-case';
import { ReviewDriverApplicationUseCase } from './application/use-cases/review-driver-application.use-case';
import { SubmitDriverApplicationUseCase } from './application/use-cases/submit-driver-application.use-case';
import { PrismaDriversRepository } from './infrastructure/repositories/prisma-drivers.repository';
import { DriversController } from './presentation/controllers/drivers.controller';

@Module({
  imports: [AuthModule],
  controllers: [DriversController],
  providers: [
    {
      provide: DRIVERS_REPOSITORY,
      useClass: PrismaDriversRepository,
    },
    GetCurrentDriverProfileUseCase,
    SubmitDriverApplicationUseCase,
    ReviewDriverApplicationUseCase,
  ],
  exports: [DRIVERS_REPOSITORY],
})
export class DriversModule {}