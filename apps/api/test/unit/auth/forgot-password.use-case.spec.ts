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
import { ForgotPasswordUseCase } from '../../../src/modules/auth/application/use-cases/forgot-password.use-case';
import type {
  AuthUserRecord,
  AuthUserRepository,
} from '../../../src/modules/auth/application/ports/auth-user.repository';
import type { AuthEmailService } from '../../../src/modules/auth/application/ports/auth-email.service';
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

describe('ForgotPasswordUseCase', () => {
  it('returns the same generic message when the email does not exist', async () => {
    const repository = createAuthRepositoryMock();
    const authEmailService = createAuthEmailServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const environmentService = {
      passwordResetTokenTtlMinutes: 20,
      authResendCooldownSeconds: 60,
      authAllowDebugCodes: true,
    } as EnvironmentService;
    const useCase = new ForgotPasswordUseCase(
      repository,
      authEmailService,
      environmentService,
      auditService,
    );

    repository.findUserByEmail.mockResolvedValue(null);

    const response = await useCase.execute({
      email: 'missing@uta.edu.ec',
    });

    expect(response).toEqual({
      message:
        'Si existe una cuenta activa con ese correo, enviamos instrucciones para restablecer la contrasena.',
    });
    expect(repository.createPasswordResetCode).not.toHaveBeenCalled();
    expect(authEmailService.sendPasswordResetCodeEmail).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('creates a reset code, sends the email and records the audit event', async () => {
    const repository = createAuthRepositoryMock();
    const authEmailService = createAuthEmailServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const environmentService = {
      passwordResetTokenTtlMinutes: 20,
      authResendCooldownSeconds: 60,
      authAllowDebugCodes: true,
    } as EnvironmentService;
    const useCase = new ForgotPasswordUseCase(
      repository,
      authEmailService,
      environmentService,
      auditService,
    );

    repository.findUserByEmail.mockResolvedValue(buildUser());
    repository.findLatestPendingPasswordResetByUserId.mockResolvedValue(null);
    authEmailService.sendPasswordResetCodeEmail.mockResolvedValue('development_preview');

    const response = await useCase.execute({
      email: ' STUDENT@UTA.EDU.EC ',
    });

    expect(response.message).toBe(
      'Si existe una cuenta activa con ese correo, enviamos instrucciones para restablecer la contrasena.',
    );
    expect(response.deliveryChannel).toBe('development_preview');
    expect(response.resetCode).toHaveLength(6);
    expect(repository.createPasswordResetCode).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.any(Date),
    );
    expect(authEmailService.sendPasswordResetCodeEmail).toHaveBeenCalledWith({
      email: 'student@uta.edu.ec',
      fullName: 'Usuario Uno',
      code: expect.any(String),
      expiresInMinutes: 20,
    });
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.AuthPasswordResetRequested,
      entityType: AuditEntityType.User,
      entityId: 'user-1',
      metadata: {
        email: 'student@uta.edu.ec',
      },
    });
  });

  it('rejects repeated requests inside the cooldown window', async () => {
    const repository = createAuthRepositoryMock();
    const authEmailService = createAuthEmailServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const environmentService = {
      passwordResetTokenTtlMinutes: 20,
      authResendCooldownSeconds: 60,
      authAllowDebugCodes: true,
    } as EnvironmentService;
    const useCase = new ForgotPasswordUseCase(
      repository,
      authEmailService,
      environmentService,
      auditService,
    );

    repository.findUserByEmail.mockResolvedValue(buildUser());
    repository.findLatestPendingPasswordResetByUserId.mockResolvedValue({
      id: 'reset-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      usedAt: null,
      createdAt: new Date(Date.now() - 15 * 1000),
    });

    await expect(
      useCase.execute({
        email: 'student@uta.edu.ec',
      }),
    ).rejects.toThrow(
      new HttpException(
        'Espera un momento antes de solicitar un nuevo codigo de recuperacion.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    expect(repository.createPasswordResetCode).not.toHaveBeenCalled();
    expect(authEmailService.sendPasswordResetCodeEmail).not.toHaveBeenCalled();
  });

  it('does not return the resetCode if authAllowDebugCodes is false', async () => {
    const repository = createAuthRepositoryMock();
    const authEmailService = createAuthEmailServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const environmentService = {
      passwordResetTokenTtlMinutes: 20,
      authResendCooldownSeconds: 60,
      authAllowDebugCodes: false,
    } as EnvironmentService;
    const useCase = new ForgotPasswordUseCase(
      repository,
      authEmailService,
      environmentService,
      auditService,
    );

    repository.findUserByEmail.mockResolvedValue(buildUser());
    repository.findLatestPendingPasswordResetByUserId.mockResolvedValue(null);
    authEmailService.sendPasswordResetCodeEmail.mockResolvedValue('development_preview');

    const response = await useCase.execute({
      email: 'student@uta.edu.ec',
    });

    expect(response.resetCode).toBeUndefined();
  });

  it('returns generic message if the user is found but emailVerifiedAt is null', async () => {
    const repository = createAuthRepositoryMock();
    const authEmailService = createAuthEmailServiceMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const environmentService = {
      passwordResetTokenTtlMinutes: 20,
      authResendCooldownSeconds: 60,
      authAllowDebugCodes: true,
    } as EnvironmentService;
    const useCase = new ForgotPasswordUseCase(
      repository,
      authEmailService,
      environmentService,
      auditService,
    );

    repository.findUserByEmail.mockResolvedValue(buildUser({ emailVerifiedAt: null }));

    const response = await useCase.execute({
      email: 'student@uta.edu.ec',
    });

    expect(response).toEqual({
      message:
        'Si existe una cuenta activa con ese correo, enviamos instrucciones para restablecer la contrasena.',
    });
    expect(repository.createPasswordResetCode).not.toHaveBeenCalled();
    expect(authEmailService.sendPasswordResetCodeEmail).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });
});
