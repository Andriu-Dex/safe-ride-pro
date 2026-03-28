import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RATINGS_REPOSITORY } from './application/ports/ratings.repository';
import { CreateRatingUseCase } from './application/use-cases/create-rating.use-case';
import { ListMyRatingsUseCase } from './application/use-cases/list-my-ratings.use-case';
import { PrismaRatingsRepository } from './infrastructure/repositories/prisma-ratings.repository';
import { RatingsController } from './presentation/controllers/ratings.controller';

@Module({
  imports: [AuthModule],
  controllers: [RatingsController],
  providers: [
    {
      provide: RATINGS_REPOSITORY,
      useClass: PrismaRatingsRepository,
    },
    CreateRatingUseCase,
    ListMyRatingsUseCase,
  ],
})
export class RatingsModule {}