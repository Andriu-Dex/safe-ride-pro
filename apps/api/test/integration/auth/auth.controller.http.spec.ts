import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DocumentType } from '@saferidepro/shared-types';

import { AuthController } from '../../../src/modules/auth/presentation/controllers/auth.controller';
import { ForgotPasswordUseCase } from '../../../src/modules/auth/application/use-cases/forgot-password.use-case';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/login.use-case';
import { LogoutUseCase } from '../../../src/modules/auth/application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../../../src/modules/auth/application/use-cases/refresh-session.use-case';
import { RegisterUserUseCase } from '../../../src/modules/auth/application/use-cases/register-user.use-case';
import { ResendVerificationCodeUseCase } from '../../../src/modules/auth/application/use-cases/resend-verification-code.use-case';
import { ResetPasswordUseCase } from '../../../src/modules/auth/application/use-cases/reset-password.use-case';
import { VerifyEmailUseCase } from '../../../src/modules/auth/application/use-cases/verify-email.use-case';
import { createHttpTestApp } from '../../helpers/create-test-app';

describe('AuthController HTTP', () => {
  let app: INestApplication;
  const registerUserUseCase = {
    execute: jest.fn(),
  };
  const verifyEmailUseCase = {
    execute: jest.fn(),
  };
  const resendVerificationCodeUseCase = {
    execute: jest.fn(),
  };
  const loginUseCase = {
    execute: jest.fn(),
  };
  const forgotPasswordUseCase = {
    execute: jest.fn(),
  };
  const resetPasswordUseCase = {
    execute: jest.fn(),
  };
  const refreshSessionUseCase = {
    execute: jest.fn(),
  };
  const logoutUseCase = {
    execute: jest.fn(),
  };

  beforeAll(async () => {
    const testApp = await createHttpTestApp({
      controllers: [AuthController],
      providers: [
        {
          provide: RegisterUserUseCase,
          useValue: registerUserUseCase,
        },
        {
          provide: VerifyEmailUseCase,
          useValue: verifyEmailUseCase,
        },
        {
          provide: ResendVerificationCodeUseCase,
          useValue: resendVerificationCodeUseCase,
        },
        {
          provide: LoginUseCase,
          useValue: loginUseCase,
        },
        {
          provide: ForgotPasswordUseCase,
          useValue: forgotPasswordUseCase,
        },
        {
          provide: ResetPasswordUseCase,
          useValue: resetPasswordUseCase,
        },
        {
          provide: RefreshSessionUseCase,
          useValue: refreshSessionUseCase,
        },
        {
          provide: LogoutUseCase,
          useValue: logoutUseCase,
        },
      ],
    });

    app = testApp.app;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a user through the HTTP endpoint', async () => {
    registerUserUseCase.execute.mockResolvedValue({
      message: 'Cuenta creada correctamente. Revisa tu correo para verificar la cuenta.',
      deliveryChannel: 'development_preview',
      verificationCode: '654321',
      user: {
        id: 'user-1',
        email: 'student@uta.edu.ec',
        fullName: 'Usuario Uno',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'student@uta.edu.ec',
        password: 'Password123',
        fullName: 'Usuario Uno',
        phone: '0999999999',
        documentType: DocumentType.NationalId,
        documentNumber: '1710034065',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Cuenta creada correctamente. Revisa tu correo para verificar la cuenta.',
      deliveryChannel: 'development_preview',
      verificationCode: '654321',
      user: {
        id: 'user-1',
        email: 'student@uta.edu.ec',
        fullName: 'Usuario Uno',
      },
    });
    expect(registerUserUseCase.execute).toHaveBeenCalledWith({
      email: 'student@uta.edu.ec',
      password: 'Password123',
      fullName: 'Usuario Uno',
      phone: '0999999999',
      documentType: DocumentType.NationalId,
      documentNumber: '1710034065',
    });
  });

  it('rejects invalid login payloads before reaching the use case', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: 'invalid-email',
        password: '',
      })
      .expect(400);

    expect(loginUseCase.execute).not.toHaveBeenCalled();
  });

  it('resends the verification code through the HTTP endpoint', async () => {
    resendVerificationCodeUseCase.execute.mockResolvedValue({
      message: 'Si la cuenta existe y sigue pendiente, enviamos un nuevo codigo de verificacion.',
      deliveryChannel: 'email',
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/resend-verification-code')
      .send({
        email: 'student@uta.edu.ec',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Si la cuenta existe y sigue pendiente, enviamos un nuevo codigo de verificacion.',
      deliveryChannel: 'email',
    });
    expect(resendVerificationCodeUseCase.execute).toHaveBeenCalledWith({
      email: 'student@uta.edu.ec',
    });
  });

  it('starts the forgot-password flow through the HTTP endpoint', async () => {
    forgotPasswordUseCase.execute.mockResolvedValue({
      message: 'Si la cuenta existe, enviamos instrucciones para recuperar la contrasena.',
      deliveryChannel: 'development_preview',
      resetCode: '123456',
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/forgot-password')
      .send({
        email: 'student@uta.edu.ec',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Si la cuenta existe, enviamos instrucciones para recuperar la contrasena.',
      deliveryChannel: 'development_preview',
      resetCode: '123456',
    });
    expect(forgotPasswordUseCase.execute).toHaveBeenCalledWith({
      email: 'student@uta.edu.ec',
    });
  });

  it('resets the password through the HTTP endpoint', async () => {
    resetPasswordUseCase.execute.mockResolvedValue({
      message: 'Contrasena actualizada correctamente. Inicia sesion con tu nueva clave.',
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/reset-password')
      .send({
        code: '123456',
        password: 'NuevaClave123',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Contrasena actualizada correctamente. Inicia sesion con tu nueva clave.',
    });
    expect(resetPasswordUseCase.execute).toHaveBeenCalledWith({
      code: '123456',
      password: 'NuevaClave123',
    });
  });

  it('refreshes the session through the HTTP endpoint', async () => {
    refreshSessionUseCase.execute.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({
        refreshToken: 'current-refresh-token',
      })
      .expect(201);

    expect(response.body).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    expect(refreshSessionUseCase.execute).toHaveBeenCalledWith({
      refreshToken: 'current-refresh-token',
    });
  });

  it('logs out through the HTTP endpoint', async () => {
    logoutUseCase.execute.mockResolvedValue({
      message: 'Sesion cerrada correctamente.',
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({
        refreshToken: 'current-refresh-token',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Sesion cerrada correctamente.',
    });
    expect(logoutUseCase.execute).toHaveBeenCalledWith({
      refreshToken: 'current-refresh-token',
    });
  });
});
