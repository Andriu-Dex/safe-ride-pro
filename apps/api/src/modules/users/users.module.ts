import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { USERS_REPOSITORY } from './application/ports/users.repository';
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case';
import { UpdateCurrentUserUseCase } from './application/use-cases/update-current-user.use-case';
import { PrismaUsersRepository } from './infrastructure/repositories/prisma-users.repository';
import { UsersController } from './presentation/controllers/users.controller';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [
    {
      provide: USERS_REPOSITORY,
      useClass: PrismaUsersRepository,
    },
    GetCurrentUserUseCase,
    UpdateCurrentUserUseCase,
  ],
  exports: [USERS_REPOSITORY],
})
export class UsersModule {}
