import { HttpException, HttpStatus } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import type { AuthEmailService } from '../../../src/modules/auth/application/ports/auth-email.service';
import type {
  AuthUserRecord,
  EmailVerificationRecord,
  AuthUserRepository,
} from '../../../src/modules/auth/application/ports/auth-user.repository';
import { ResendVerificationCodeUseCase } from '../../../src/modules/auth/application/use-cases/resend-verification-code.use-case';
import { EnvironmentService } from '../../../src/shared/infrastructure/config/environment.service';

function createAuthRepositoryMock(): jest.Mocked<AuthUserRepository> {
  return {
    findInstitutionByDomain: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createUserWithMembership: jest.fn(),
    createEmailVerificationCode: jest.fn(),
    findLatestPendingEmailVerificationByUserId: jest.fn(),
    findValidEmailVerification: jest.fn(),
    markEmailAsVerified: jest.fn(),
    createPasswordResetCode: jest.fn(),
    findLatestPendingPasswordResetByUserId: jest.fn(),
    findValidPasswordResetCode: jest.fn(),
    markPasswordResetCodeAsUsed: jest.fn(),
    updatePassword: jest.fn(),
    createRefreshTokenSession: jest.fn(),
    findValidRefreshTokenSession: jest.fn(),
    revokeRefreshTokenSession: jest.fn(),
    revokeAllRefreshTokenSessionsForUser: jest.fn(),
  };
}

function createAuthEmailServiceMock(): jest.Mocked<AuthEmailService> {
  return {
    sendVerificationCodeEmail: jest.fn(),
    sendPasswordResetCodeEmail: jest.fn(),
  };
}

function createAuditServiceMock(): jest.Mocked<AuditService> {
  return {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;
}

function createEnvironmentServiceMock(overrides: Partial<EnvironmentService> = {}): EnvironmentService {
  return {
    get authResendCooldownSeconds(): number {
      return overrides.authResendCooldownSeconds ?? 60;
    },
    get emailVerificationTokenTtlMinutes(): number {
      return overrides.emailVerificationTokenTtlMinutes ?? 15;
    },
    get authAllowDebugCodes(): boolean {
      return overrides.authAllowDebugCodes ?? false;
    },
  } as unknown as EnvironmentService;
}

function buildAuthUserRecord(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    id: 'user-1',
    email: 'student@uta.edu.ec',
    passwordHash: 'hash-password',
    fullName: 'Student User',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    emailVerifiedAt: new Date(),
    memberships: [
      {
        id: 'membership-1',
        institutionId: 'inst-1',
        institutionName: 'UTA',
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'STUDENT-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
    ...overrides,
  };
}

function buildEmailVerificationRecord(overrides: Partial<EmailVerificationRecord> = {}): EmailVerificationRecord {
  return {
    id: 'verification-id',
    userId: 'user-1',
    expiresAt: new Date('2030-01-01T10:00:00.000Z'),
    verifiedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('ResendVerificationCodeUseCase', () => {
  it('returns immediate message if user is not found or emailVerifiedAt is set', async () => {
    const repository = createAuthRepositoryMock();
    const emailService = createAuthEmailServiceMock();
    const auditService = createAuditServiceMock();
    const environmentService = createEnvironmentServiceMock();

    repository.findUserByEmail.mockResolvedValue(null);

    const useCase = new ResendVerificationCodeUseCase(repository, emailService, environmentService, auditService);
    const result = await useCase.execute({ email: 'non-existent@uta.edu.ec' });

    expect(repository.findUserByEmail).toHaveBeenCalledWith('non-existent@uta.edu.ec');
    expect(result).toEqual({
      message: 'Si existe una cuenta pendiente, enviamos un nuevo codigo de verificacion.',
    });
  });

  it('throws TOO_MANY_REQUESTS exception if requesting during cooldown', async () => {
    const repository = createAuthRepositoryMock();
    const emailService = createAuthEmailServiceMock();
    const auditService = createAuditServiceMock();
    const environmentService = createEnvironmentServiceMock({
      authResendCooldownSeconds: 60,
    });

    const mockUser = buildAuthUserRecord({
      emailVerifiedAt: null,
      accountStatus: AccountStatus.PendingEmailVerification,
    });
    repository.findUserByEmail.mockResolvedValue(mockUser);
    // last code was created 10 seconds ago
    repository.findLatestPendingEmailVerificationByUserId.mockResolvedValue(
      buildEmailVerificationRecord({
        createdAt: new Date(Date.now() - 10000),
      }),
    );

    const useCase = new ResendVerificationCodeUseCase(repository, emailService, environmentService, auditService);

    await expect(useCase.execute({ email: 'student@uta.edu.ec' })).rejects.toThrow(
      new HttpException('Espera un momento antes de solicitar un nuevo codigo.', HttpStatus.TOO_MANY_REQUESTS),
    );
  });

  it('generates new code, sends email, and returns result with verificationCode if debug is enabled', async () => {
    const repository = createAuthRepositoryMock();
    const emailService = createAuthEmailServiceMock();
    const auditService = createAuditServiceMock();
    const environmentService = createEnvironmentServiceMock({
      authResendCooldownSeconds: 60,
      emailVerificationTokenTtlMinutes: 15,
      authAllowDebugCodes: true,
    });

    const mockUser = buildAuthUserRecord({
      emailVerifiedAt: null,
      accountStatus: AccountStatus.PendingEmailVerification,
    });
    repository.findUserByEmail.mockResolvedValue(mockUser);
    repository.findLatestPendingEmailVerificationByUserId.mockResolvedValue(null);
    emailService.sendVerificationCodeEmail.mockResolvedValue('development_preview');

    const useCase = new ResendVerificationCodeUseCase(repository, emailService, environmentService, auditService);
    const result = await useCase.execute({ email: 'student@uta.edu.ec' });

    expect(repository.createEmailVerificationCode).toHaveBeenCalledWith('user-1', expect.any(String), expect.any(Date));
    expect(emailService.sendVerificationCodeEmail).toHaveBeenCalledWith({
      email: 'student@uta.edu.ec',
      fullName: 'Student User',
      code: expect.any(String),
      expiresInMinutes: 15,
    });
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      actorUserId: 'user-1',
      action: AuditAction.AuthVerificationCodeResent,
      entityType: AuditEntityType.AuthSession,
      entityId: 'user-1',
      metadata: {
        email: 'student@uta.edu.ec',
      },
    });
    expect(result.message).toBe('Enviamos un nuevo codigo de verificacion a tu correo.');
    expect(result.deliveryChannel).toBe('development_preview');
    expect(result.verificationCode).toBeDefined(); // should be returned as a string since debug is enabled
  });
});
