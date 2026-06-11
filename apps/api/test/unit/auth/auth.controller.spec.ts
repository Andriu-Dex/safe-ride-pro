import { AuthController } from '../../../src/modules/auth/presentation/controllers/auth.controller';
import { RegisterUserUseCase } from '../../../src/modules/auth/application/use-cases/register-user.use-case';
import { VerifyEmailUseCase } from '../../../src/modules/auth/application/use-cases/verify-email.use-case';
import { ResendVerificationCodeUseCase } from '../../../src/modules/auth/application/use-cases/resend-verification-code.use-case';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/login.use-case';
import { ForgotPasswordUseCase } from '../../../src/modules/auth/application/use-cases/forgot-password.use-case';
import { ResetPasswordUseCase } from '../../../src/modules/auth/application/use-cases/reset-password.use-case';
import { RefreshSessionUseCase } from '../../../src/modules/auth/application/use-cases/refresh-session.use-case';
import { LogoutUseCase } from '../../../src/modules/auth/application/use-cases/logout.use-case';

describe('AuthController', () => {
  let controller: AuthController;
  let registerUserUseCase: jest.Mocked<RegisterUserUseCase>;
  let verifyEmailUseCase: jest.Mocked<VerifyEmailUseCase>;
  let resendVerificationCodeUseCase: jest.Mocked<ResendVerificationCodeUseCase>;
  let loginUseCase: jest.Mocked<LoginUseCase>;
  let forgotPasswordUseCase: jest.Mocked<ForgotPasswordUseCase>;
  let resetPasswordUseCase: jest.Mocked<ResetPasswordUseCase>;
  let refreshSessionUseCase: jest.Mocked<RefreshSessionUseCase>;
  let logoutUseCase: jest.Mocked<LogoutUseCase>;

  beforeEach(() => {
    registerUserUseCase = { execute: jest.fn() } as any;
    verifyEmailUseCase = { execute: jest.fn() } as any;
    resendVerificationCodeUseCase = { execute: jest.fn() } as any;
    loginUseCase = { execute: jest.fn() } as any;
    forgotPasswordUseCase = { execute: jest.fn() } as any;
    resetPasswordUseCase = { execute: jest.fn() } as any;
    refreshSessionUseCase = { execute: jest.fn() } as any;
    logoutUseCase = { execute: jest.fn() } as any;

    controller = new AuthController(
      registerUserUseCase,
      verifyEmailUseCase,
      resendVerificationCodeUseCase,
      loginUseCase,
      forgotPasswordUseCase,
      resetPasswordUseCase,
      refreshSessionUseCase,
      logoutUseCase,
    );
  });

  it('calls loginUseCase (covers line 50)', async () => {
    loginUseCase.execute.mockResolvedValue('logged-in' as any);
    const result = await controller.login({ email: 'test@example.com', password: 'password' } as any);
    expect(loginUseCase.execute).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password' });
    expect(result).toBe('logged-in');
  });
});
