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
import type { AccessTokenService } from '../../../src/modules/auth/application/ports/access-token.service';
import type { AuthUserRecord, AuthUserRepository } from '../../../src/modules/auth/application/ports/auth-user.repository';
import type { PasswordHasher } from '../../../src/modules/auth/application/ports/password-hasher';

function createAuthRepositoryMock(): jest.Mocked<AuthUserRepository> {
  return {
    findInstitutionByDomain: jest.fn(),
    findUserByEmail: jest.fn(),
    createUserWithMembership: jest.fn(),
    createEmailVerificationCode: jest.fn(),
    findValidEmailVerification: jest.fn(),
    markEmailAsVerified: jest.fn(),
  };
}

function createPasswordHasherMock(): jest.Mocked<PasswordHasher> {
  return {
    hash: jest.fn(),
    compare: jest.fn(),
  };
}

function createAccessTokenServiceMock(): jest.Mocked<AccessTokenService> {
  return {
    sign: jest.fn(),
  };
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
    const accessTokenService = createAccessTokenServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new LoginUseCase(
      repository,
      passwordHasher,
      accessTokenService,
      auditService,
    );

    repository.findUserByEmail.mockResolvedValue(buildUser());
    passwordHasher.compare.mockResolvedValue(true);
    accessTokenService.sign.mockResolvedValue('access-token');

    const response = await useCase.execute({
      email: ' STUDENT@UTA.EDU.EC ',
      password: 'Password123',
    });

    expect(response.accessToken).toBe('access-token');
    expect(response.user.email).toBe('student@uta.edu.ec');
    expect(accessTokenService.sign).toHaveBeenCalledWith('user-1', GlobalUserRole.User);
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
    const accessTokenService = createAccessTokenServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new LoginUseCase(
      repository,
      passwordHasher,
      accessTokenService,
      auditService,
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
    expect(accessTokenService.sign).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials and records the failure reason', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const accessTokenService = createAccessTokenServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new LoginUseCase(
      repository,
      passwordHasher,
      accessTokenService,
      auditService,
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
    expect(accessTokenService.sign).not.toHaveBeenCalled();
  });
});
