import { BadRequestException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';
import { createHash } from 'node:crypto';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuthSessionService } from '../../../src/modules/auth/application/services/auth-session.service';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { VerifyEmailUseCase } from '../../../src/modules/auth/application/use-cases/verify-email.use-case';
import type { AuthUserRecord, AuthUserRepository } from '../../../src/modules/auth/application/ports/auth-user.repository';

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

function buildVerifiedUser(): AuthUserRecord {
  return {
    id: 'user-1',
    email: 'student@uta.edu.ec',
    passwordHash: 'hashed-password',
    fullName: 'Usuario Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    emailVerifiedAt: new Date('2030-01-01T09:00:00.000Z'),
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
  };
}

describe('VerifyEmailUseCase', () => {
  it('verifies the email and records the audit event', async () => {
    const repository = createAuthRepositoryMock();
    const authSessionService = {
      issueTokens: jest.fn(),
    } as unknown as jest.Mocked<AuthSessionService>;
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new VerifyEmailUseCase(repository, auditService, authSessionService);

    repository.findValidEmailVerification.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      expiresAt: new Date('2030-01-01T10:00:00.000Z'),
      verifiedAt: null,
      createdAt: new Date('2030-01-01T09:00:00.000Z'),
    });
    repository.markEmailAsVerified.mockResolvedValue(buildVerifiedUser());
    authSessionService.issueTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshTokenHash: 'refresh-hash',
      refreshTokenExpiresAt: new Date('2030-01-15T10:00:00.000Z'),
    });

    const response = await useCase.execute('verification-token');

    expect(response.message).toBe('Correo verificado correctamente.');
    expect(response.accessToken).toBe('access-token');
    expect(response.refreshToken).toBe('refresh-token');
    expect(repository.findValidEmailVerification).toHaveBeenCalledWith(
      createHash('sha256').update('verification-token').digest('hex'),
      expect.any(Date),
    );
    expect(repository.markEmailAsVerified).toHaveBeenCalledWith(
      'user-1',
      'token-1',
      expect.any(Date),
    );
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.AuthEmailVerified,
      entityType: AuditEntityType.User,
      entityId: 'user-1',
      metadata: {
        email: 'student@uta.edu.ec',
      },
    });
    expect(repository.createRefreshTokenSession).toHaveBeenCalledWith(
      'user-1',
      'refresh-hash',
      expect.any(Date),
    );
  });

  it('rejects an invalid or expired verification code', async () => {
    const repository = createAuthRepositoryMock();
    const authSessionService = {
      issueTokens: jest.fn(),
    } as unknown as jest.Mocked<AuthSessionService>;
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new VerifyEmailUseCase(repository, auditService, authSessionService);

    repository.findValidEmailVerification.mockResolvedValue(null);

    await expect(useCase.execute('invalid-token')).rejects.toThrow(
      new BadRequestException('El codigo de verificacion es invalido o ha expirado.'),
    );

    expect(repository.markEmailAsVerified).not.toHaveBeenCalled();
  });
});
