import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AccountStatus,
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
    findDriverProfileByMembershipId: jest.fn(),
    findDriverProfileByLicenseNumber: jest.fn(),
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
): DriverProfileRecord {
  return {
    membershipId: 'membership-target',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    driverVerificationStatus: status,
    licenseType: {
      id: 'license-type-1',
      code: 'B',
      name: 'Licencia B',
    },
    licenseNumber: 'ABC-123',
    licenseExpiresAt: new Date('2030-01-01T10:00:00.000Z'),
    identityDocumentFileKey: null,
    licenseDocumentFileKey: null,
    reviewNotes: null,
    reviewedAt: null,
    reviewedByUserId: null,
    submittedAt: new Date('2030-01-01T09:00:00.000Z'),
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
});
