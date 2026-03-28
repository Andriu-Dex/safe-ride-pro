import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DocumentType } from '@saferidepro/shared-types';

import { AuthController } from '../../../src/modules/auth/presentation/controllers/auth.controller';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/login.use-case';
import { RegisterUserUseCase } from '../../../src/modules/auth/application/use-cases/register-user.use-case';
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
  const loginUseCase = {
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
          provide: LoginUseCase,
          useValue: loginUseCase,
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
      message: 'Cuenta creada correctamente. Verifica tu correo para activarla.',
      verificationToken: 'token-123',
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
        documentNumber: '0123456789',
        studentCode: 'STUDENT-001',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Cuenta creada correctamente. Verifica tu correo para activarla.',
      verificationToken: 'token-123',
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
      documentNumber: '0123456789',
      studentCode: 'STUDENT-001',
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
});
