import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { EnvironmentModule } from '../../shared/infrastructure/config/environment.module';
import { EnvironmentService } from '../../shared/infrastructure/config/environment.service';
import { ACCESS_TOKEN_SERVICE } from './application/ports/access-token.service';
import { AUTH_EMAIL_SERVICE } from './application/ports/auth-email.service';
import { AUTH_USER_REPOSITORY } from './application/ports/auth-user.repository';
import { PASSWORD_HASHER } from './application/ports/password-hasher';
import { REFRESH_TOKEN_SERVICE } from './application/ports/refresh-token.service';
import { AuthRateLimitService } from './application/services/auth-rate-limit.service';
import { AuthSessionService } from './application/services/auth-session.service';
import { ForgotPasswordUseCase } from './application/use-cases/forgot-password.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { ResendVerificationCodeUseCase } from './application/use-cases/resend-verification-code.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { VerifyEmailUseCase } from './application/use-cases/verify-email.use-case';
import { ResendAuthEmailService } from './infrastructure/notifications/resend-auth-email.service';
import { PrismaAuthUserRepository } from './infrastructure/repositories/prisma-auth-user.repository';
import { BcryptPasswordHasherService } from './infrastructure/security/bcrypt-password-hasher.service';
import { CryptoRefreshTokenService } from './infrastructure/security/crypto-refresh-token.service';
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
          expiresIn: `${environmentService.accessTokenTtlMinutes}m`,
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
      provide: REFRESH_TOKEN_SERVICE,
      useClass: CryptoRefreshTokenService,
    },
    {
      provide: ACCESS_TOKEN_SERVICE,
      useClass: JwtAccessTokenService,
    },
    {
      provide: AUTH_EMAIL_SERVICE,
      useClass: ResendAuthEmailService,
    },
    AuthRateLimitService,
    AuthSessionService,
    RegisterUserUseCase,
    VerifyEmailUseCase,
    ResendVerificationCodeUseCase,
    LoginUseCase,
    ForgotPasswordUseCase,
    ResetPasswordUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    JwtAuthGuard,
    SuperAdminGuard,
  ],
  exports: [JwtAuthGuard, SuperAdminGuard, JwtModule],
})
export class AuthModule {}
