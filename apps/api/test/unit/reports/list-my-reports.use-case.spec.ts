import { ForbiddenException } from '@nestjs/common';
import { MembershipStatus, ReportStatus, TripStatus } from '@saferidepro/shared-types';

import { ListMyReportsUseCase } from '../../../src/modules/reports/application/use-cases/list-my-reports.use-case';
import type {
  ReportRecord,
  ReportsRepository,
} from '../../../src/modules/reports/application/ports/reports.repository';

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

function buildReportRecord(overrides: Partial<ReportRecord> = {}): ReportRecord {
  return {
    id: 'report-1',
    tripId: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    reporterMembershipId: 'membership-1',
    reporterUserId: 'user-passenger',
    reporterFullName: 'Pasajero Uno',
    reportedMembershipId: 'membership-reported',
    reportedUserId: 'user-reported',
    reportedFullName: 'Reportado Uno',
    tripStatus: TripStatus.Completed,
    tripOriginLabel: 'Huachi',
    tripDestinationLabel: 'Centro',
    tripDepartureAt: new Date(),
    tripCompletedAt: new Date(),
    tripClosureNote: null,
    status: ReportStatus.Pending,
    reason: 'UNSAFE_DRIVING',
    description: 'Conduccion temeraria',
    evidenceFileKey: null,
    reviewNote: null,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewedByFullName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ListMyReportsUseCase', () => {
  it('throws ForbiddenException if default membership is not found', async () => {
    const repository = createReportsRepositoryMock();
    const useCase = new ListMyReportsUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue(null);

    await expect(useCase.execute('user-1')).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para consultar reportes.'),
    );
  });

  it('throws ForbiddenException if default membership status is not Active', async () => {
    const repository = createReportsRepositoryMock();
    const useCase = new ListMyReportsUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      fullName: 'Andrea Pasajera',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Inactive,
    });

    await expect(useCase.execute('user-1')).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para consultar reportes.'),
    );
  });

  it('returns reports list for active membership successfully', async () => {
    const repository = createReportsRepositoryMock();
    const useCase = new ListMyReportsUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      fullName: 'Andrea Pasajera',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
    });

    const mockReports = [
      buildReportRecord({ id: 'report-1', reporterMembershipId: 'membership-1' }),
      buildReportRecord({ id: 'report-2', reporterMembershipId: 'membership-1' }),
    ];

    repository.listReportsByReporterMembershipId.mockResolvedValue(mockReports);

    const result = await useCase.execute('user-1');

    expect(repository.listReportsByReporterMembershipId).toHaveBeenCalledWith('membership-1');
    expect(result.items).toEqual(mockReports);
  });
});
