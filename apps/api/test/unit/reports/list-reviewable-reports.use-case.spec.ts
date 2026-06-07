import { ForbiddenException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  ReportStatus,
} from '@saferidepro/shared-types';

import { ListReviewableReportsUseCase } from '../../../src/modules/reports/application/use-cases/list-reviewable-reports.use-case';
import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import type { ReportsRepository } from '../../../src/modules/reports/application/ports/reports.repository';

function createReportsRepositoryMock(): jest.Mocked<ReportsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findTripById: jest.fn(),
    hasReportableTripParticipation: jest.fn(),
    findReportById: jest.fn(),
    findExistingReport: jest.fn(),
    createReport: jest.fn(),
    listReportsByReporterMembershipId: jest.fn(),
    listReviewableReports: jest.fn(),
    reviewReport: jest.fn(),
  };
}

function buildRegularUser(): CurrentUserContext {
  return {
    id: 'user-1',
    email: 'user@uta.edu.ec',
    fullName: 'Usuario Regular',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-student',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        institutionIsActive: true,
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'STUDENT-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
  };
}

function buildInstitutionAdminUser(
  overrides?: Partial<CurrentUserContext['memberships'][number]>,
): CurrentUserContext {
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
        ...overrides,
      },
    ],
  };
}

describe('ListReviewableReportsUseCase', () => {
  it('forbids access when the current user is not administrative', async () => {
    const repository = createReportsRepositoryMock();
    const useCase = new ListReviewableReportsUseCase(repository);

    await expect(
      useCase.execute({
        currentUser: buildRegularUser(),
        status: ReportStatus.Pending,
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes permisos para revisar reportes.'));

    expect(repository.listReviewableReports).not.toHaveBeenCalled();
  });

  it('forbids access when the administrative membership belongs to an inactive institution', async () => {
    const repository = createReportsRepositoryMock();
    const useCase = new ListReviewableReportsUseCase(repository);

    await expect(
      useCase.execute({
        currentUser: buildInstitutionAdminUser({
          institutionIsActive: false,
        }),
        status: ReportStatus.Pending,
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes permisos para revisar reportes.'));

    expect(repository.listReviewableReports).not.toHaveBeenCalled();
  });

  it('allows SuperAdmin to view all reports across all institutions', async () => {
    const repository = createReportsRepositoryMock();
    const mockList = [{ id: 'report-1' } as any];
    repository.listReviewableReports.mockResolvedValue(mockList);
    const useCase = new ListReviewableReportsUseCase(repository);

    const superAdmin: CurrentUserContext = {
      id: 'super-1',
      email: 'super@saferidepro.com',
      fullName: 'Super Admin',
      globalRole: GlobalUserRole.SuperAdmin,
      accountStatus: AccountStatus.Active,
      memberships: [],
    };

    const result = await useCase.execute({
      currentUser: superAdmin,
      status: ReportStatus.Pending,
    });

    expect(repository.listReviewableReports).toHaveBeenCalledWith({
      institutionIds: undefined,
      userId: undefined,
      status: ReportStatus.Pending,
      limit: undefined,
    });
    expect(result.items).toBe(mockList);
  });

  it('allows SuperAdmin to view reports for a specific institution', async () => {
    const repository = createReportsRepositoryMock();
    repository.listReviewableReports.mockResolvedValue([]);
    const useCase = new ListReviewableReportsUseCase(repository);

    const superAdmin: CurrentUserContext = {
      id: 'super-1',
      email: 'super@saferidepro.com',
      fullName: 'Super Admin',
      globalRole: GlobalUserRole.SuperAdmin,
      accountStatus: AccountStatus.Active,
      memberships: [],
    };

    await useCase.execute({
      currentUser: superAdmin,
      institutionId: 'institution-1',
    });

    expect(repository.listReviewableReports).toHaveBeenCalledWith({
      institutionIds: ['institution-1'],
      userId: undefined,
      status: undefined,
      limit: undefined,
    });
  });

  it('allows InstitutionAdmin to view reports for their accessible institutions', async () => {
    const repository = createReportsRepositoryMock();
    repository.listReviewableReports.mockResolvedValue([]);
    const useCase = new ListReviewableReportsUseCase(repository);

    await useCase.execute({
      currentUser: buildInstitutionAdminUser(),
      status: ReportStatus.Pending,
    });

    expect(repository.listReviewableReports).toHaveBeenCalledWith({
      institutionIds: ['institution-1'],
      userId: undefined,
      status: ReportStatus.Pending,
      limit: undefined,
    });
  });

  it('allows InstitutionAdmin to view reports for a specific accessible institution', async () => {
    const repository = createReportsRepositoryMock();
    repository.listReviewableReports.mockResolvedValue([]);
    const useCase = new ListReviewableReportsUseCase(repository);

    await useCase.execute({
      currentUser: buildInstitutionAdminUser(),
      institutionId: 'institution-1',
    });

    expect(repository.listReviewableReports).toHaveBeenCalledWith({
      institutionIds: ['institution-1'],
      userId: undefined,
      status: undefined,
      limit: undefined,
    });
  });

  it('forbids InstitutionAdmin from viewing reports for an inaccessible institution', async () => {
    const repository = createReportsRepositoryMock();
    const useCase = new ListReviewableReportsUseCase(repository);

    await expect(
      useCase.execute({
        currentUser: buildInstitutionAdminUser(),
        institutionId: 'institution-other',
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes permisos para revisar reportes de esa institucion.'));

    expect(repository.listReviewableReports).not.toHaveBeenCalled();
  });
});
