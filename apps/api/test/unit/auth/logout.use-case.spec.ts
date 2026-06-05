import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import type { AuthUserRecord, AuthUserRepository } from '../../../src/modules/auth/application/ports/auth-user.repository';
import type { RefreshTokenService } from '../../../src/modules/auth/application/ports/refresh-token.service';
import { LogoutUseCase } from '../../../src/modules/auth/application/use-cases/logout.use-case';

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

describe('LogoutUseCase', () => {
  it('returns success message immediately if refresh session is invalid or expired', async () => {
    const repository = createAuthRepositoryMock();
    const tokenService = createRefreshTokenServiceMock();
    const auditService = createAuditServiceMock();

    tokenService.hash.mockReturnValue('hash-123');
    repository.findValidRefreshTokenSession.mockResolvedValue(null);

    const useCase = new LogoutUseCase(repository, tokenService, auditService);
    const result = await useCase.execute({ refreshToken: '  token-123  ' });

    expect(tokenService.hash).toHaveBeenCalledWith('token-123');
    expect(repository.findValidRefreshTokenSession).toHaveBeenCalledWith('hash-123', expect.any(Date));
    expect(repository.revokeRefreshTokenSession).not.toHaveBeenCalled();
    expect(result).toEqual({ message: 'La sesion se cerro correctamente.' });
  });

  it('revokes session and records audit event if valid refresh session is found', async () => {
    const repository = createAuthRepositoryMock();
    const tokenService = createRefreshTokenServiceMock();
    const auditService = createAuditServiceMock();

    tokenService.hash.mockReturnValue('hash-123');
    const mockSession = {
      id: 'session-id',
      userId: 'user-1',
      tokenHash: 'hash-123',
      expiresAt: new Date(),
      revokedAt: null,
      createdAt: new Date(),
    };
    repository.findValidRefreshTokenSession.mockResolvedValue(mockSession);
    repository.findUserById.mockResolvedValue(buildAuthUserRecord());

    const useCase = new LogoutUseCase(repository, tokenService, auditService);
    const result = await useCase.execute({ refreshToken: 'token-123' });

    expect(repository.revokeRefreshTokenSession).toHaveBeenCalledWith('session-id', expect.any(Date));
    expect(repository.findUserById).toHaveBeenCalledWith('user-1');
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'inst-1',
      actorUserId: 'user-1',
      action: AuditAction.AuthLoggedOut,
      entityType: AuditEntityType.AuthSession,
      entityId: 'user-1',
      metadata: {
        email: 'student@uta.edu.ec',
      },
    });
    expect(result).toEqual({ message: 'La sesion se cerro correctamente.' });
  });
});
