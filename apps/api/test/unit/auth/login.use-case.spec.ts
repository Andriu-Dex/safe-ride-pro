import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { LoginUseCase } from '../../../src/modules/auth/application/use-cases/login.use-case';
import type { AuthUserRecord, AuthUserRepository } from '../../../src/modules/auth/application/ports/auth-user.repository';
import type { PasswordHasher } from '../../../src/modules/auth/application/ports/password-hasher';
import { AuthRateLimitService } from '../../../src/modules/auth/application/services/auth-rate-limit.service';
import { AuthSessionService } from '../../../src/modules/auth/application/services/auth-session.service';
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

function createPasswordHasherMock(): jest.Mocked<PasswordHasher> {
  return {
    hash: jest.fn(),
    compare: jest.fn(),
  };
}

function createAuthSessionServiceMock(): jest.Mocked<AuthSessionService> {
  return {
    issueTokens: jest.fn(),
  } as unknown as jest.Mocked<AuthSessionService>;
}

function buildUser(overrides: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    id: 'user-1',
    email: 'student@uta.edu.ec',
    passwordHash: 'hashed-password',
    fullName: 'Usuario Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    emailVerifiedAt: new Date('2030-01-01T08:00:00.000Z'),
    memberships: [
      {
        id: 'membership-1',
        institutionId: 'institution-1',
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

describe('LoginUseCase', () => {
  it('returns an access token and records a successful audit event', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const authSessionService = createAuthSessionServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const authRateLimitService = {
      assertAllowed: jest.fn(),
      recordFailure: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<AuthRateLimitService>;
    const environmentService = {
      authFailedAttemptLimit: 5,
      authFailedAttemptWindowMinutes: 10,
    } as EnvironmentService;
    const useCase = new LoginUseCase(
      repository,
      passwordHasher,
      auditService,
      authSessionService,
      authRateLimitService,
      environmentService,
    );

    repository.findUserByEmail.mockResolvedValue(buildUser());
    passwordHasher.compare.mockResolvedValue(true);
    authSessionService.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshTokenHash: 'refresh-token-hash',
      refreshTokenExpiresAt: new Date('2030-01-15T00:00:00.000Z'),
    });

    const response = await useCase.execute({
      email: ' STUDENT@UTA.EDU.EC ',
      password: 'Password123',
    });

    expect(response.accessToken).toBe('access-token');
    expect(response.refreshToken).toBe('refresh-token');
    expect(response.user.email).toBe('student@uta.edu.ec');
    expect(authSessionService.issueTokens).toHaveBeenCalledWith('user-1', GlobalUserRole.User);
    expect(repository.createRefreshTokenSession).toHaveBeenCalledWith(
      'user-1',
      'refresh-token-hash',
      new Date('2030-01-15T00:00:00.000Z'),
    );
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.AuthLoginSucceeded,
      entityType: AuditEntityType.AuthSession,
      entityId: 'user-1',
      metadata: {
        email: 'student@uta.edu.ec',
      },
    });
  });

  it('rejects login when the email is not verified and records the failure', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const authSessionService = createAuthSessionServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const authRateLimitService = {
      assertAllowed: jest.fn(),
      recordFailure: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<AuthRateLimitService>;
    const environmentService = {
      authFailedAttemptLimit: 5,
      authFailedAttemptWindowMinutes: 10,
    } as EnvironmentService;
    const useCase = new LoginUseCase(
      repository,
      passwordHasher,
      auditService,
      authSessionService,
      authRateLimitService,
      environmentService,
    );

    repository.findUserByEmail.mockResolvedValue(
      buildUser({
        accountStatus: AccountStatus.PendingEmailVerification,
        emailVerifiedAt: null,
      }),
    );
    passwordHasher.compare.mockResolvedValue(true);

    await expect(
      useCase.execute({
        email: 'student@uta.edu.ec',
        password: 'Password123',
      }),
    ).rejects.toThrow(
      new ForbiddenException('Debes verificar tu correo antes de iniciar sesion.'),
    );

    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.AuthLoginFailed,
      entityType: AuditEntityType.AuthSession,
      metadata: {
        email: 'student@uta.edu.ec',
        reason: 'EMAIL_NOT_VERIFIED',
      },
    });
    expect(authSessionService.issueTokens).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials and records the failure reason', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const authSessionService = createAuthSessionServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const authRateLimitService = {
      assertAllowed: jest.fn(),
      recordFailure: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<AuthRateLimitService>;
    const environmentService = {
      authFailedAttemptLimit: 5,
      authFailedAttemptWindowMinutes: 10,
    } as EnvironmentService;
    const useCase = new LoginUseCase(
      repository,
      passwordHasher,
      auditService,
      authSessionService,
      authRateLimitService,
      environmentService,
    );

    repository.findUserByEmail.mockResolvedValue(buildUser());
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      useCase.execute({
        email: 'student@uta.edu.ec',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(new UnauthorizedException('Credenciales invalidas.'));

    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.AuthLoginFailed,
      entityType: AuditEntityType.AuthSession,
      metadata: {
        email: 'student@uta.edu.ec',
        reason: 'INVALID_CREDENTIALS',
      },
    });
    expect(authSessionService.issueTokens).not.toHaveBeenCalled();
  });

  it('rejects login when the email does not exist and records the failure', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const authSessionService = createAuthSessionServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const authRateLimitService = {
      assertAllowed: jest.fn(),
      recordFailure: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<AuthRateLimitService>;
    const environmentService = {
      authFailedAttemptLimit: 5,
      authFailedAttemptWindowMinutes: 10,
    } as EnvironmentService;
    const useCase = new LoginUseCase(
      repository,
      passwordHasher,
      auditService,
      authSessionService,
      authRateLimitService,
      environmentService,
    );

    repository.findUserByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({
        email: 'missing@uta.edu.ec',
        password: 'Password123',
      }),
    ).rejects.toThrow(new UnauthorizedException('Credenciales invalidas.'));

    expect(auditService.record).toHaveBeenCalledWith({
      action: AuditAction.AuthLoginFailed,
      entityType: AuditEntityType.AuthSession,
      metadata: {
        email: 'missing@uta.edu.ec',
        reason: 'INVALID_CREDENTIALS',
      },
    });
    expect(authRateLimitService.recordFailure).toHaveBeenCalled();
    expect(authSessionService.issueTokens).not.toHaveBeenCalled();
  });

  it('rejects login when the account is suspended and records the failure', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const authSessionService = createAuthSessionServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const authRateLimitService = {
      assertAllowed: jest.fn(),
      recordFailure: jest.fn(),
      clear: jest.fn(),
    } as unknown as jest.Mocked<AuthRateLimitService>;
    const environmentService = {
      authFailedAttemptLimit: 5,
      authFailedAttemptWindowMinutes: 10,
    } as EnvironmentService;
    const useCase = new LoginUseCase(
      repository,
      passwordHasher,
      auditService,
      authSessionService,
      authRateLimitService,
      environmentService,
    );

    repository.findUserByEmail.mockResolvedValue(
      buildUser({
        accountStatus: AccountStatus.Suspended,
      }),
    );
    passwordHasher.compare.mockResolvedValue(true);

    await expect(
      useCase.execute({
        email: 'student@uta.edu.ec',
        password: 'Password123',
      }),
    ).rejects.toThrow(new ForbiddenException('Esta cuenta se encuentra suspendida.'));

    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.AuthLoginFailed,
      entityType: AuditEntityType.AuthSession,
      metadata: {
        email: 'student@uta.edu.ec',
        reason: 'ACCOUNT_SUSPENDED',
      },
    });
    expect(authRateLimitService.clear).toHaveBeenCalled();
    expect(authSessionService.issueTokens).not.toHaveBeenCalled();
  });
});
