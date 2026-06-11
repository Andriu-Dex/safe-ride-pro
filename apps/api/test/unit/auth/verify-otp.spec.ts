import { BadRequestException } from '@nestjs/common';
import { AccountStatus, DriverVerificationStatus, GlobalUserRole, InstitutionMembershipRole, MembershipStatus } from '@saferidepro/shared-types';
import { createHash } from 'node:crypto';

import { VerifyEmailUseCase } from '../../../src/modules/auth/application/use-cases/verify-email.use-case';
import { AuthSessionService } from '../../../src/modules/auth/application/services/auth-session.service';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import type { AuthUserRecord, AuthUserRepository } from '../../../src/modules/auth/application/ports/auth-user.repository';

describe('VerifyEmailUseCase - OTP Expiration Edge Cases', () => {
  let repositoryMock: jest.Mocked<AuthUserRepository>;
  let authSessionServiceMock: jest.Mocked<AuthSessionService>;
  let auditServiceMock: jest.Mocked<AuditService>;
  let useCase: VerifyEmailUseCase;

  beforeEach(() => {
    repositoryMock = {
      findValidEmailVerification: jest.fn(),
      markEmailAsVerified: jest.fn(),
      createRefreshTokenSession: jest.fn(),
    } as any;

    authSessionServiceMock = {
      issueTokens: jest.fn(),
    } as any;

    auditServiceMock = {
      record: jest.fn(),
    } as any;

    useCase = new VerifyEmailUseCase(repositoryMock, auditServiceMock, authSessionServiceMock);
  });

  const buildUserMock = (): AuthUserRecord => ({
    id: 'user-123',
    email: 'student@uta.edu.ec',
    passwordHash: 'hashed-password',
    fullName: 'Erick Aguilar',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    emailVerifiedAt: new Date(),
    memberships: [
      {
        id: 'membership-123',
        institutionId: 'inst-123',
        institutionName: 'UTA',
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: '1804561239',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
  });

  it('debe limpiar los espacios en blanco del codigo OTP enviado (metodo trim)', async () => {
    const rawOtp = '  OTP-123-ABC  ';
    const trimmedOtp = 'OTP-123-ABC';
    const tokenHash = createHash('sha256').update(trimmedOtp).digest('hex');

    repositoryMock.findValidEmailVerification.mockResolvedValue({
      id: 'verify-1',
      userId: 'user-123',
      expiresAt: new Date(Date.now() + 600000), // Vence en 10 min
      verifiedAt: null,
      createdAt: new Date(),
    });

    repositoryMock.markEmailAsVerified.mockResolvedValue(buildUserMock());
    authSessionServiceMock.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshTokenHash: 'refresh-hash',
      refreshTokenExpiresAt: new Date(Date.now() + 1200000),
    });

    const result = await useCase.execute(rawOtp);
    expect(result.accessToken).toBe('access-token');
    expect(repositoryMock.findValidEmailVerification).toHaveBeenCalledWith(
      tokenHash,
      expect.any(Date),
    );
  });

  it('debe validar exitosamente si el codigo es verificado exactamente un milisegundo antes de expirar', async () => {
    const otp = 'OTP-VALID';
    const tokenHash = createHash('sha256').update(otp).digest('hex');
    
    // Configurar expiracion exacta
    const expiresAt = new Date('2030-01-01T10:00:00.000Z');
    
    // Simular que el caso de uso se ejecuta exactamente un milisegundo antes: 09:59:59.999
    const testingTime = new Date('2030-01-01T09:59:59.999Z');
    
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(testingTime);

    repositoryMock.findValidEmailVerification.mockImplementation(async (hash, now) => {
      if (hash === tokenHash && now.getTime() < expiresAt.getTime()) {
        return {
          id: 'verify-2',
          userId: 'user-123',
          expiresAt: expiresAt,
          verifiedAt: null,
          createdAt: new Date(),
        };
      }
      return null;
    });

    repositoryMock.markEmailAsVerified.mockResolvedValue(buildUserMock());
    authSessionServiceMock.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshTokenHash: 'refresh-hash',
      refreshTokenExpiresAt: new Date(),
    });

    const result = await useCase.execute(otp);
    expect(result.accessToken).toBe('access-token');
    
    jest.useRealTimers();
  });

  it('debe fallar y lanzar BadRequestException si el codigo se valida en el instante exacto de expiracion', async () => {
    const otp = 'OTP-EXPIRED';
    const expiresAt = new Date('2030-01-01T10:00:00.000Z');
    
    // Simular ejecucion en el momento exacto: 10:00:00.000
    const testingTime = new Date('2030-01-01T10:00:00.000Z');
    
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(testingTime);

    repositoryMock.findValidEmailVerification.mockResolvedValue(null);

    await expect(useCase.execute(otp)).rejects.toThrow(BadRequestException);
    
    jest.useRealTimers();
  });
});
