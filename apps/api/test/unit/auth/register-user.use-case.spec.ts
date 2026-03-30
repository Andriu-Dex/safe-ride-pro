import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  AccountStatus,
  DocumentType,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { RegisterUserUseCase } from '../../../src/modules/auth/application/use-cases/register-user.use-case';
import type {
  AuthUserRecord,
  AuthUserRepository,
} from '../../../src/modules/auth/application/ports/auth-user.repository';
import type { PasswordHasher } from '../../../src/modules/auth/application/ports/password-hasher';
import { EnvironmentService } from '../../../src/shared/infrastructure/config/environment.service';

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

function buildCreatedUser(email: string): AuthUserRecord {
  return {
    id: 'user-1',
    email,
    passwordHash: 'hashed-password',
    fullName: 'Usuario Registrado',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.PendingEmailVerification,
    emailVerifiedAt: null,
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

describe('RegisterUserUseCase', () => {
  it('creates a user, verification code and audit event using normalized data', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const environmentService = {
      emailVerificationTokenTtlMinutes: 30,
    } as EnvironmentService;
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new RegisterUserUseCase(
      repository,
      passwordHasher,
      environmentService,
      auditService,
    );

    repository.findInstitutionByDomain.mockResolvedValue({
      id: 'institution-1',
      name: 'UTA',
      code: 'UTA',
    });
    repository.findUserByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('hashed-password');
    repository.createUserWithMembership.mockImplementation(async (input) => buildCreatedUser(input.email));

    const response = await useCase.execute({
      email: '  STUDENT@UTA.EDU.EC ',
      password: 'Password123',
      fullName: '  Usuario Registrado  ',
      phone: ' 0999999999 ',
      documentType: DocumentType.NationalId,
      documentNumber: ' 1710034065 ',
    });

    expect(response.message).toBe('Cuenta creada correctamente. Usa el codigo de verificacion para activarla.');
    expect(response.user.email).toBe('student@uta.edu.ec');
    expect(response.verificationCode).toHaveLength(6);
    expect(passwordHasher.hash).toHaveBeenCalledWith('Password123');
    expect(repository.createUserWithMembership).toHaveBeenCalledWith({
      email: 'student@uta.edu.ec',
      passwordHash: 'hashed-password',
      fullName: 'Usuario Registrado',
      phone: '0999999999',
      documentType: DocumentType.NationalId,
      documentNumber: '1710034065',
      studentCode: undefined,
      institutionId: 'institution-1',
    });
    expect(repository.createEmailVerificationCode).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.any(Date),
    );
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-1',
      action: AuditAction.AuthRegistered,
      entityType: AuditEntityType.User,
      entityId: 'user-1',
      metadata: {
        email: 'student@uta.edu.ec',
      },
    });
  });

  it('rejects duplicate registered emails', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const environmentService = {
      emailVerificationTokenTtlMinutes: 30,
    } as EnvironmentService;
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new RegisterUserUseCase(
      repository,
      passwordHasher,
      environmentService,
      auditService,
    );

    repository.findInstitutionByDomain.mockResolvedValue({
      id: 'institution-1',
      name: 'UTA',
      code: 'UTA',
    });
    repository.findUserByEmail.mockResolvedValue(buildCreatedUser('student@uta.edu.ec'));

    await expect(
      useCase.execute({
        email: 'student@uta.edu.ec',
        password: 'Password123',
        fullName: 'Usuario',
        documentType: DocumentType.NationalId,
        documentNumber: '1710034065',
      }),
    ).rejects.toThrow(
      new ConflictException('Ya existe una cuenta registrada con este correo.'),
    );

    expect(repository.createUserWithMembership).not.toHaveBeenCalled();
  });

  it('rejects an invalid Ecuadorian national id', async () => {
    const repository = createAuthRepositoryMock();
    const passwordHasher = createPasswordHasherMock();
    const environmentService = {
      emailVerificationTokenTtlMinutes: 30,
    } as EnvironmentService;
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new RegisterUserUseCase(
      repository,
      passwordHasher,
      environmentService,
      auditService,
    );

    repository.findInstitutionByDomain.mockResolvedValue({
      id: 'institution-1',
      name: 'UTA',
      code: 'UTA',
    });
    repository.findUserByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({
        email: 'student@uta.edu.ec',
        password: 'Password123',
        fullName: 'Usuario',
        documentType: DocumentType.NationalId,
        documentNumber: '0123456789',
      }),
    ).rejects.toThrow(new BadRequestException('La cedula ecuatoriana no es valida.'));

    expect(repository.createUserWithMembership).not.toHaveBeenCalled();
  });
});
