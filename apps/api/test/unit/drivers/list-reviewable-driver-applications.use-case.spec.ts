import { ForbiddenException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import type { DriverProfileRecord, DriversRepository } from '../../../src/modules/drivers/application/ports/drivers.repository';
import { ListReviewableDriverApplicationsUseCase } from '../../../src/modules/drivers/application/use-cases/list-reviewable-driver-applications.use-case';

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

function buildCurrentUser(overrides: Partial<CurrentUserContext> = {}): CurrentUserContext {
  return {
    id: 'user-1',
    email: 'user@uta.edu.ec',
    fullName: 'Test User',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [],
    ...overrides,
  };
}

function buildDriverProfileRecord(overrides: Partial<DriverProfileRecord> = {}): DriverProfileRecord {
  return {
    membershipId: 'm1',
    userId: 'user-2',
    userFullName: 'Driver Applicant',
    userEmail: 'driver@uta.edu.ec',
    institutionId: 'inst-1',
    institutionName: 'UTA',
    driverVerificationStatus: DriverVerificationStatus.PendingVerification,
    licenseType: {
      id: 'l1',
      code: 'TYPE-C',
      name: 'Tipo C',
    },
    licenseExpiresAt: new Date('2030-12-31T23:59:59.000Z'),
    identityDocumentFileKey: 'key-id',
    licenseDocumentFileKey: 'key-license',
    reviewNotes: null,
    reviewedAt: null,
    reviewedByUserId: null,
    submittedAt: new Date(),
    ...overrides,
  };
}

describe('ListReviewableDriverApplicationsUseCase', () => {
  it('throws ForbiddenException if user has no administrative scope', async () => {
    const repository = createDriversRepositoryMock();
    const useCase = new ListReviewableDriverApplicationsUseCase(repository);

    await expect(
      useCase.execute({
        currentUser: buildCurrentUser({ globalRole: GlobalUserRole.User, memberships: [] }),
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes permisos para revisar solicitudes de conductor.'));
  });

  it('throws ForbiddenException if requested institutionId is not accessible', async () => {
    const repository = createDriversRepositoryMock();
    const useCase = new ListReviewableDriverApplicationsUseCase(repository);

    await expect(
      useCase.execute({
        currentUser: buildCurrentUser({
          globalRole: GlobalUserRole.User,
          memberships: [
            {
              id: 'm1',
              institutionId: 'inst-1',
              institutionName: 'UTA',
              role: InstitutionMembershipRole.InstitutionAdmin,
              membershipStatus: MembershipStatus.Active,
              institutionIsActive: true,
              studentCode: '123',
              isDefault: true,
              driverVerificationStatus: DriverVerificationStatus.NotRequested,
            },
          ],
        }),
        institutionId: 'inst-2',
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes permisos para revisar solicitudes de esa institucion.'));
  });

  it('calls listReviewableDriverApplications on repository with specific requested institutionId as SuperAdmin', async () => {
    const repository = createDriversRepositoryMock();
    const mockList = [buildDriverProfileRecord({ membershipId: 'm1' })];
    repository.listReviewableDriverApplications.mockResolvedValue(mockList);

    const useCase = new ListReviewableDriverApplicationsUseCase(repository);
    const result = await useCase.execute({
      currentUser: buildCurrentUser({ globalRole: GlobalUserRole.SuperAdmin }),
      institutionId: 'inst-3',
      status: DriverVerificationStatus.PendingVerification,
      limit: 10,
    });

    expect(repository.listReviewableDriverApplications).toHaveBeenCalledWith({
      institutionIds: ['inst-3'],
      status: DriverVerificationStatus.PendingVerification,
      limit: 10,
    });
    expect(result.items).toBe(mockList);
  });

  it('calls listReviewableDriverApplications on repository with all accessible institutionIds for InstitutionAdmin', async () => {
    const repository = createDriversRepositoryMock();
    const mockList = [buildDriverProfileRecord({ membershipId: 'm1' })];
    repository.listReviewableDriverApplications.mockResolvedValue(mockList);

    const useCase = new ListReviewableDriverApplicationsUseCase(repository);
    const result = await useCase.execute({
      currentUser: buildCurrentUser({
        globalRole: GlobalUserRole.User,
        memberships: [
          {
            id: 'm1',
            institutionId: 'inst-1',
            institutionName: 'UTA',
            role: InstitutionMembershipRole.InstitutionAdmin,
            membershipStatus: MembershipStatus.Active,
            institutionIsActive: true,
            studentCode: '123',
            isDefault: true,
            driverVerificationStatus: DriverVerificationStatus.NotRequested,
          },
          {
            id: 'm2',
            institutionId: 'inst-2',
            institutionName: 'PUCE',
            role: InstitutionMembershipRole.InstitutionAdmin,
            membershipStatus: MembershipStatus.Active,
            institutionIsActive: true,
            studentCode: '456',
            isDefault: false,
            driverVerificationStatus: DriverVerificationStatus.NotRequested,
          },
        ],
      }),
      status: DriverVerificationStatus.PendingVerification,
    });

    expect(repository.listReviewableDriverApplications).toHaveBeenCalledWith({
      institutionIds: ['inst-1', 'inst-2'],
      status: DriverVerificationStatus.PendingVerification,
      limit: undefined,
    });
    expect(result.items).toBe(mockList);
  });
});
