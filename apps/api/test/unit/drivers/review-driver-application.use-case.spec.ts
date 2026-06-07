import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  DriverLicenseStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { ReviewDriverApplicationUseCase } from '../../../src/modules/drivers/application/use-cases/review-driver-application.use-case';
import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import type {
  DriverMembershipRecord,
  DriverProfileRecord,
  DriversRepository,
} from '../../../src/modules/drivers/application/ports/drivers.repository';

function createDriversRepositoryMock(): jest.Mocked<DriversRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findMembershipById: jest.fn(),
    listInstitutionAdminMembershipIds: jest.fn(),
    findDriverProfileByMembershipId: jest.fn(),
    listReviewableDriverApplications: jest.fn(),
    submitDriverApplication: jest.fn(),
    reviewDriverApplication: jest.fn(),
  };
}

function buildAdminUser(): CurrentUserContext {
  return {
    id: 'admin-1',
    email: 'admin@uta.edu.ec',
    fullName: 'Admin UTA',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-admin',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        institutionIsActive: true,
        role: InstitutionMembershipRole.InstitutionAdmin,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'ADMIN-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
  };
}

function buildTargetMembership(): DriverMembershipRecord {
  return {
    id: 'membership-target',
    userId: 'user-2',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    role: InstitutionMembershipRole.Student,
    membershipStatus: MembershipStatus.Active,
    studentCode: 'STUDENT-002',
    isDefault: true,
    driverVerificationStatus: DriverVerificationStatus.PendingVerification,
  };
}

function buildDriverProfile(
  status: DriverVerificationStatus,
  overrides: Partial<DriverProfileRecord> = {},
): DriverProfileRecord {
  return {
    membershipId: 'membership-target',
    userId: 'user-2',
    userFullName: 'Usuario Dos',
    userEmail: 'user2@uta.edu.ec',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    driverVerificationStatus: status,
    licenseType: {
      id: 'license-type-1',
      code: 'B',
      name: 'Licencia B',
    },
    licenseExpiresAt: new Date('2030-01-01T10:00:00.000Z'),
    licenseStatus: DriverLicenseStatus.Valid,
    licenseExpiresInDays: 120,
    identityDocumentFileKey: 'identity-file',
    licenseDocumentFileKey: 'license-file',
    hasRequiredDocuments: true,
    reviewNotes: null,
    reviewedAt: null,
    reviewedByUserId: null,
    submittedAt: new Date('2030-01-01T09:00:00.000Z'),
    ...overrides,
  };
}

describe('ReviewDriverApplicationUseCase', () => {
  it('requires review notes when rejecting a driver application', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewDriverApplicationUseCase(repository, auditService);

    repository.findMembershipById.mockResolvedValue(buildTargetMembership());
    repository.findDriverProfileByMembershipId.mockResolvedValue(
      buildDriverProfile(DriverVerificationStatus.PendingVerification),
    );

    await expect(
      useCase.execute(buildAdminUser(), {
        membershipId: 'membership-target',
        decision: DriverVerificationStatus.Rejected,
      }),
    ).rejects.toThrow(new BadRequestException('Debes indicar el motivo del rechazo.'));

    expect(repository.reviewDriverApplication).not.toHaveBeenCalled();
  });

  it('approves the application and records audit when the reviewer has permissions', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewDriverApplicationUseCase(repository, auditService);

    repository.findMembershipById.mockResolvedValue(buildTargetMembership());
    repository.findDriverProfileByMembershipId.mockResolvedValue(
      buildDriverProfile(DriverVerificationStatus.PendingVerification),
    );
    repository.reviewDriverApplication.mockResolvedValue(
      buildDriverProfile(DriverVerificationStatus.Approved),
    );

    const response = await useCase.execute(buildAdminUser(), {
      membershipId: 'membership-target',
      decision: DriverVerificationStatus.Approved,
    });

    expect(response.message).toBe('La solicitud de conductor fue aprobada correctamente.');
    expect(repository.reviewDriverApplication).toHaveBeenCalledWith({
      membershipId: 'membership-target',
      reviewerUserId: 'admin-1',
      decision: DriverVerificationStatus.Approved,
      reviewNotes: undefined,
    });
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'admin-1',
      action: AuditAction.DriverApplicationApproved,
      entityType: AuditEntityType.DriverProfile,
      entityId: 'membership-target',
      metadata: {
        decision: DriverVerificationStatus.Approved,
      },
    });
  });

  it('blocks approving an expired license or incomplete documents', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewDriverApplicationUseCase(repository, auditService);

    repository.findMembershipById.mockResolvedValue(buildTargetMembership());
    repository.findDriverProfileByMembershipId
      .mockResolvedValueOnce(
        buildDriverProfile(DriverVerificationStatus.PendingVerification, {
          licenseStatus: DriverLicenseStatus.Expired,
          licenseExpiresInDays: -1,
          licenseExpiresAt: new Date('2020-01-01T10:00:00.000Z'),
        }),
      )
      .mockResolvedValueOnce(
        buildDriverProfile(DriverVerificationStatus.PendingVerification, {
          identityDocumentFileKey: null,
          hasRequiredDocuments: false,
        }),
      );

    await expect(
      useCase.execute(buildAdminUser(), {
        membershipId: 'membership-target',
        decision: DriverVerificationStatus.Approved,
      }),
    ).rejects.toThrow(
      new BadRequestException('No puedes aprobar una solicitud con la licencia vencida.'),
    );

    await expect(
      useCase.execute(buildAdminUser(), {
        membershipId: 'membership-target',
        decision: DriverVerificationStatus.Approved,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Debes contar con documento de identidad y licencia adjuntos antes de aprobar la solicitud.',
      ),
    );

    expect(repository.reviewDriverApplication).not.toHaveBeenCalled();
  });

  it('rejects reviewers without access to the institution', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewDriverApplicationUseCase(repository, auditService);

    repository.findMembershipById.mockResolvedValue(buildTargetMembership());

    const unauthorizedReviewer: CurrentUserContext = {
      ...buildAdminUser(),
      memberships: [
        {
          ...buildAdminUser().memberships[0],
          institutionId: 'institution-2',
          institutionName: 'Otra institucion',
        },
      ],
    };

    await expect(
      useCase.execute(unauthorizedReviewer, {
        membershipId: 'membership-target',
        decision: DriverVerificationStatus.Approved,
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'No tienes permisos para revisar solicitudes de esta institucion.',
      ),
    );
  });

  it('rejects inactive institutional contexts even if the role is administrative', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewDriverApplicationUseCase(repository, auditService);

    repository.findMembershipById.mockResolvedValue(buildTargetMembership());

    await expect(
      useCase.execute(
        {
          ...buildAdminUser(),
          memberships: [
            {
              ...buildAdminUser().memberships[0],
              institutionIsActive: false,
            },
          ],
        },
        {
          membershipId: 'membership-target',
          decision: DriverVerificationStatus.Approved,
        },
      ),
    ).rejects.toThrow(
      new ForbiddenException(
        'No tienes permisos para revisar solicitudes de esta institucion.',
      ),
    );
  });

  it('blocks self-review and inactive target memberships', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewDriverApplicationUseCase(repository, auditService);

    repository.findMembershipById
      .mockResolvedValueOnce({
        ...buildTargetMembership(),
        userId: 'admin-1',
      })
      .mockResolvedValueOnce({
        ...buildTargetMembership(),
        membershipStatus: MembershipStatus.Suspended,
      });

    await expect(
      useCase.execute(buildAdminUser(), {
        membershipId: 'membership-target',
        decision: DriverVerificationStatus.Approved,
      }),
    ).rejects.toThrow(
      new ForbiddenException('No puedes revisar tu propia solicitud de conductor.'),
    );

    await expect(
      useCase.execute(buildAdminUser(), {
        membershipId: 'membership-target',
        decision: DriverVerificationStatus.Approved,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Solo puedes revisar solicitudes asociadas a membresias activas.',
      ),
    );
  });

  it('throws NotFoundException if target membership is not found', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewDriverApplicationUseCase(repository, auditService);

    repository.findMembershipById.mockResolvedValue(null);

    await expect(
      useCase.execute(buildAdminUser(), {
        membershipId: 'membership-not-found',
        decision: DriverVerificationStatus.Approved,
      }),
    ).rejects.toThrow(new NotFoundException('La solicitud de conductor no existe.'));
  });

  it('throws NotFoundException if driver profile is not found', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewDriverApplicationUseCase(repository, auditService);

    repository.findMembershipById.mockResolvedValue(buildTargetMembership());
    repository.findDriverProfileByMembershipId.mockResolvedValue(null);

    await expect(
      useCase.execute(buildAdminUser(), {
        membershipId: 'membership-target',
        decision: DriverVerificationStatus.Approved,
      }),
    ).rejects.toThrow(new NotFoundException('La solicitud de conductor aun no ha sido enviada.'));
  });

  it('allows SuperAdmin to review an application successfully', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewDriverApplicationUseCase(repository, auditService);

    repository.findMembershipById.mockResolvedValue(buildTargetMembership());
    repository.findDriverProfileByMembershipId.mockResolvedValue(
      buildDriverProfile(DriverVerificationStatus.PendingVerification),
    );
    repository.reviewDriverApplication.mockResolvedValue(
      buildDriverProfile(DriverVerificationStatus.Approved),
    );

    const superAdmin: CurrentUserContext = {
      id: 'superadmin-1',
      email: 'superadmin@saferidepro.com',
      fullName: 'Super Admin',
      globalRole: GlobalUserRole.SuperAdmin,
      accountStatus: AccountStatus.Active,
      memberships: [],
    };

    const response = await useCase.execute(superAdmin, {
      membershipId: 'membership-target',
      decision: DriverVerificationStatus.Approved,
    });

    expect(response.message).toBe('La solicitud de conductor fue aprobada correctamente.');
    expect(repository.reviewDriverApplication).toHaveBeenCalledWith({
      membershipId: 'membership-target',
      reviewerUserId: 'superadmin-1',
      decision: DriverVerificationStatus.Approved,
      reviewNotes: undefined,
    });
  });

  it('rejects the application and records audit when requested', async () => {
    const repository = createDriversRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewDriverApplicationUseCase(repository, auditService);

    repository.findMembershipById.mockResolvedValue(buildTargetMembership());
    repository.findDriverProfileByMembershipId.mockResolvedValue(
      buildDriverProfile(DriverVerificationStatus.PendingVerification),
    );
    repository.reviewDriverApplication.mockResolvedValue(
      buildDriverProfile(DriverVerificationStatus.Rejected),
    );

    const response = await useCase.execute(buildAdminUser(), {
      membershipId: 'membership-target',
      decision: DriverVerificationStatus.Rejected,
      reviewNotes: 'Documentos no legibles',
    });

    expect(response.message).toBe('La solicitud de conductor fue rechazada correctamente.');
    expect(repository.reviewDriverApplication).toHaveBeenCalledWith({
      membershipId: 'membership-target',
      reviewerUserId: 'admin-1',
      decision: DriverVerificationStatus.Rejected,
      reviewNotes: 'Documentos no legibles',
    });
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'admin-1',
      action: AuditAction.DriverApplicationRejected,
      entityType: AuditEntityType.DriverProfile,
      entityId: 'membership-target',
      metadata: {
        decision: DriverVerificationStatus.Rejected,
      },
    });
  });
});
