import { Body, Controller, Post } from '@nestjs/common';

import { ForgotPasswordUseCase } from '../../application/use-cases/forgot-password.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { ResendVerificationCodeUseCase } from '../../application/use-cases/resend-verification-code.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case';
import { ForgotPasswordRequestDto } from '../dto/forgot-password.request.dto';
import { LoginRequestDto } from '../dto/login.request.dto';
import { LogoutRequestDto } from '../dto/logout.request.dto';
import { RefreshSessionRequestDto } from '../dto/refresh-session.request.dto';
import { RegisterRequestDto } from '../dto/register.request.dto';
import { ResendVerificationCodeRequestDto } from '../dto/resend-verification-code.request.dto';
import { ResetPasswordRequestDto } from '../dto/reset-password.request.dto';
import { VerifyEmailRequestDto } from '../dto/verify-email.request.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly resendVerificationCodeUseCase: ResendVerificationCodeUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly forgotPasswordUseCase: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

  @Post('register')
  register(@Body() body: RegisterRequestDto) {
    return this.registerUserUseCase.execute(body);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: VerifyEmailRequestDto) {
    return this.verifyEmailUseCase.execute(body.code);
  }

  @Post('resend-verification-code')
  resendVerificationCode(@Body() body: ResendVerificationCodeRequestDto) {
    return this.resendVerificationCodeUseCase.execute(body);
  }

  @Post('login')
  login(@Body() body: LoginRequestDto) {
    return this.loginUseCase.execute(body);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordRequestDto) {
    return this.forgotPasswordUseCase.execute(body);
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordRequestDto) {
    return this.resetPasswordUseCase.execute(body);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshSessionRequestDto) {
    return this.refreshSessionUseCase.execute(body);
  }

  @Post('logout')
  logout(@Body() body: LogoutRequestDto) {
    return this.logoutUseCase.execute(body);
  }
}
