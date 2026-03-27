import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { EnvironmentModule } from '../../shared/infrastructure/config/environment.module';
import { EnvironmentService } from '../../shared/infrastructure/config/environment.service';
import { ACCESS_TOKEN_SERVICE } from './application/ports/access-token.service';
import { AUTH_USER_REPOSITORY } from './application/ports/auth-user.repository';
import { PASSWORD_HASHER } from './application/ports/password-hasher';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { PrismaAuthUserRepository } from './infrastructure/repositories/prisma-auth-user.repository';
import { BcryptPasswordHasherService } from './infrastructure/security/bcrypt-password-hasher.service';
import { JwtAccessTokenService } from './infrastructure/security/jwt-access-token.service';
import { AuthController } from './presentation/controllers/auth.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { SuperAdminGuard } from './presentation/guards/super-admin.guard';

@Module({
  imports: [
    EnvironmentModule,
    JwtModule.registerAsync({
      inject: [EnvironmentService],
      useFactory: (environmentService: EnvironmentService) => ({
        secret: environmentService.jwtSecret,
        signOptions: {
          expiresIn: '1d',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_USER_REPOSITORY,
      useClass: PrismaAuthUserRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasherService,
    },
    {
      provide: ACCESS_TOKEN_SERVICE,
      useClass: JwtAccessTokenService,
    },
    RegisterUserUseCase,
    VerifyEmailUseCase,
    LoginUseCase,
    JwtAuthGuard,
    SuperAdminGuard,
  ],
  exports: [JwtAuthGuard, SuperAdminGuard, JwtModule],
})
export class AuthModule {}
