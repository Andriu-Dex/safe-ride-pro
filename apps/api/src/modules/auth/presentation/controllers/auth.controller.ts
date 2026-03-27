import { Body, Controller, Post } from '@nestjs/common';

import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case';
import { LoginRequestDto } from '../dto/login.request.dto';
import { RegisterRequestDto } from '../dto/register.request.dto';
import { VerifyEmailRequestDto } from '../dto/verify-email.request.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  @Post('register')
  register(@Body() body: RegisterRequestDto) {
    return this.registerUserUseCase.execute(body);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: VerifyEmailRequestDto) {
    return this.verifyEmailUseCase.execute(body.token);
  }

  @Post('login')
  login(@Body() body: LoginRequestDto) {
    return this.loginUseCase.execute(body);
  }
}
