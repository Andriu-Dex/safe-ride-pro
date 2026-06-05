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
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import type {
  AuthUserRecord,
  AuthUserRepository,
} from '../../../src/modules/auth/application/ports/auth-user.repository';
import type { PasswordHasher } from '../../../src/modules/auth/application/ports/password-hasher';
import { ResetPasswordUseCase } from '../../../src/modules/auth/application/use-cases/reset-password.use-case';

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

describe('ResetPasswordUseCase', () => {
  it('rejects an invalid or expired recovery code', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ResetPasswordUseCase(repository, passwordHasher, auditService);

    repository.findValidPasswordResetCode.mockResolvedValue(null);

    await expect(
      useCase.execute({
        code: '123456',
        password: 'NewPassword123',
      }),
    ).rejects.toThrow(
      new BadRequestException('El codigo de recuperacion es invalido o ha expirado.'),
    );

    expect(repository.findValidPasswordResetCode).toHaveBeenCalledWith(
      createHash('sha256').update('123456').digest('hex'),
      expect.any(Date),
    );
    expect(repository.updatePassword).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ResetPasswordUseCase(repository, passwordHasher, auditService);

    repository.findValidPasswordResetCode.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
      expiresAt: new Date('2030-01-10T00:00:00.000Z'),
      usedAt: null,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    repository.findUserById.mockResolvedValue(buildUser());
    passwordHasher.compare.mockResolvedValue(true);

    await expect(
      useCase.execute({
        code: '123456',
        password: 'Password123',
      }),
    ).rejects.toThrow(
      new BadRequestException('La nueva contrasena no puede ser igual a la anterior.'),
    );

    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(repository.updatePassword).not.toHaveBeenCalled();
  });

  it('updates the password, invalidates the code and revokes active sessions', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ResetPasswordUseCase(repository, passwordHasher, auditService);

    repository.findValidPasswordResetCode.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
      expiresAt: new Date('2030-01-10T00:00:00.000Z'),
      usedAt: null,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    repository.findUserById.mockResolvedValue(buildUser());
    passwordHasher.compare.mockResolvedValue(false);
    passwordHasher.hash.mockResolvedValue('new-hashed-password');

    const response = await useCase.execute({
      code: '123456',
      password: 'NewPassword123',
    });

    expect(response).toEqual({
      message: 'La contrasena se actualizo correctamente. Ya puedes iniciar sesion.',
    });
    expect(passwordHasher.hash).toHaveBeenCalledWith('NewPassword123');
    expect(repository.updatePassword).toHaveBeenCalledWith('user-1', 'new-hashed-password');
    expect(repository.markPasswordResetCodeAsUsed).toHaveBeenCalledWith(
      'reset-1',
      expect.any(Date),
    );
    expect(repository.revokeAllRefreshTokenSessionsForUser).toHaveBeenCalledWith(
      'user-1',
      expect.any(Date),
    );
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.AuthPasswordResetCompleted,
      entityType: AuditEntityType.User,
      entityId: 'user-1',
      metadata: {
        email: 'student@uta.edu.ec',
      },
    });
  });

  it('rejects if the user associated with the code no longer exists', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ResetPasswordUseCase(repository, passwordHasher, auditService);

    repository.findValidPasswordResetCode.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
      expiresAt: new Date('2030-01-10T00:00:00.000Z'),
      usedAt: null,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    repository.findUserById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        code: '123456',
        password: 'NewPassword123',
      }),
    ).rejects.toThrow(new BadRequestException('La cuenta asociada ya no existe.'));
  });

  it('updates the password even if user has no default membership', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ResetPasswordUseCase(repository, passwordHasher, auditService);

    repository.findValidPasswordResetCode.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
      expiresAt: new Date('2030-01-10T00:00:00.000Z'),
      usedAt: null,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    repository.findUserById.mockResolvedValue(buildUser({ memberships: [] }));
    passwordHasher.compare.mockResolvedValue(false);
    passwordHasher.hash.mockResolvedValue('new-hashed-password');

    const response = await useCase.execute({
      code: '123456',
      password: 'NewPassword123',
    });

    expect(response.message).toBe('La contrasena se actualizo correctamente. Ya puedes iniciar sesion.');
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: undefined,
      actorUserId: 'user-1',
      action: AuditAction.AuthPasswordResetCompleted,
      entityType: AuditEntityType.User,
      entityId: 'user-1',
      metadata: {
        email: 'student@uta.edu.ec',
      },
    });
  });
});
