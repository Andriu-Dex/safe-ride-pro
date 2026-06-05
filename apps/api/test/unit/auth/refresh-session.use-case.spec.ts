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
import type {
  AuthUserRecord,
  RefreshTokenSessionRecord,
  AuthUserRepository,
} from '../../../src/modules/auth/application/ports/auth-user.repository';
import type { RefreshTokenService } from '../../../src/modules/auth/application/ports/refresh-token.service';
import { AuthSessionService } from '../../../src/modules/auth/application/services/auth-session.service';
import { RefreshSessionUseCase } from '../../../src/modules/auth/application/use-cases/refresh-session.use-case';

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

function createRefreshTokenServiceMock(): jest.Mocked<RefreshTokenService> {
  return {
    issue: jest.fn(),
    hash: jest.fn(),
  };
}

function createAuthSessionServiceMock(): jest.Mocked<AuthSessionService> {
  return {
    issueTokens: jest.fn(),
  } as unknown as jest.Mocked<AuthSessionService>;
}

function createAuditServiceMock(): jest.Mocked<AuditService> {
  return {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;
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

function buildRefreshTokenSessionRecord(overrides: Partial<RefreshTokenSessionRecord> = {}): RefreshTokenSessionRecord {
  return {
    id: 'session-id',
    userId: 'user-1',
    expiresAt: new Date('2030-01-15T00:00:00.000Z'),
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('RefreshSessionUseCase', () => {
  it('throws UnauthorizedException if refresh session is invalid', async () => {
    const repository = createAuthRepositoryMock();
    const tokenService = createRefreshTokenServiceMock();
    const sessionService = createAuthSessionServiceMock();
    const auditService = createAuditServiceMock();

    tokenService.hash.mockReturnValue('hash-123');
    repository.findValidRefreshTokenSession.mockResolvedValue(null);

    const useCase = new RefreshSessionUseCase(repository, tokenService, sessionService, auditService);

    await expect(useCase.execute({ refreshToken: 'token-123' })).rejects.toThrow(
      new UnauthorizedException('La sesion ya no es valida. Ingresa nuevamente.'),
    );
  });

  it('throws UnauthorizedException and revokes session if user not found', async () => {
    const repository = createAuthRepositoryMock();
    const tokenService = createRefreshTokenServiceMock();
    const sessionService = createAuthSessionServiceMock();
    const auditService = createAuditServiceMock();

    tokenService.hash.mockReturnValue('hash-123');
    repository.findValidRefreshTokenSession.mockResolvedValue(buildRefreshTokenSessionRecord());
    repository.findUserById.mockResolvedValue(null);

    const useCase = new RefreshSessionUseCase(repository, tokenService, sessionService, auditService);

    await expect(useCase.execute({ refreshToken: 'token-123' })).rejects.toThrow(
      new UnauthorizedException('La sesion ya no es valida. Ingresa nuevamente.'),
    );
    expect(repository.revokeRefreshTokenSession).toHaveBeenCalledWith('session-id', expect.any(Date));
  });

  it('throws ForbiddenException if email is not verified', async () => {
    const repository = createAuthRepositoryMock();
    const tokenService = createRefreshTokenServiceMock();
    const sessionService = createAuthSessionServiceMock();
    const auditService = createAuditServiceMock();

    tokenService.hash.mockReturnValue('hash-123');
    repository.findValidRefreshTokenSession.mockResolvedValue(buildRefreshTokenSessionRecord());
    repository.findUserById.mockResolvedValue(
      buildAuthUserRecord({
        emailVerifiedAt: null,
        accountStatus: AccountStatus.PendingEmailVerification,
      }),
    );

    const useCase = new RefreshSessionUseCase(repository, tokenService, sessionService, auditService);

    await expect(useCase.execute({ refreshToken: 'token-123' })).rejects.toThrow(
      new ForbiddenException('Debes verificar tu correo antes de continuar.'),
    );
  });

  it('throws ForbiddenException if user is Suspended', async () => {
    const repository = createAuthRepositoryMock();
    const tokenService = createRefreshTokenServiceMock();
    const sessionService = createAuthSessionServiceMock();
    const auditService = createAuditServiceMock();

    tokenService.hash.mockReturnValue('hash-123');
    repository.findValidRefreshTokenSession.mockResolvedValue(buildRefreshTokenSessionRecord());
    repository.findUserById.mockResolvedValue(
      buildAuthUserRecord({
        accountStatus: AccountStatus.Suspended,
      }),
    );

    const useCase = new RefreshSessionUseCase(repository, tokenService, sessionService, auditService);

    await expect(useCase.execute({ refreshToken: 'token-123' })).rejects.toThrow(
      new ForbiddenException('Esta cuenta se encuentra suspendida.'),
    );
  });

  it('issues new tokens, revokes old session, creates new session and records audit', async () => {
    const repository = createAuthRepositoryMock();
    const tokenService = createRefreshTokenServiceMock();
    const sessionService = createAuthSessionServiceMock();
    const auditService = createAuditServiceMock();

    tokenService.hash.mockReturnValue('hash-123');
    repository.findValidRefreshTokenSession.mockResolvedValue(buildRefreshTokenSessionRecord());
    repository.findUserById.mockResolvedValue(buildAuthUserRecord());

    const expiresAt = new Date('2030-01-15T00:00:00.000Z');
    sessionService.issueTokens.mockResolvedValue({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
      refreshTokenHash: 'next-hash',
      refreshTokenExpiresAt: expiresAt,
    });

    const useCase = new RefreshSessionUseCase(repository, tokenService, sessionService, auditService);
    const result = await useCase.execute({ refreshToken: 'token-123' });

    expect(sessionService.issueTokens).toHaveBeenCalledWith('user-1', GlobalUserRole.User);
    expect(repository.revokeRefreshTokenSession).toHaveBeenCalledWith('session-id', expect.any(Date));
    expect(repository.createRefreshTokenSession).toHaveBeenCalledWith('user-1', 'next-hash', expiresAt);
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      actorUserId: 'user-1',
      action: AuditAction.AuthSessionRefreshed,
      entityType: AuditEntityType.AuthSession,
      entityId: 'user-1',
      metadata: {
        email: 'student@uta.edu.ec',
      },
    });
    expect(result).toEqual({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
    });
  });
});
