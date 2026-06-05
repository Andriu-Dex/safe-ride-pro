import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  ReportStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { GetReportEvidenceUseCase } from '../../../src/modules/reports/application/use-cases/get-report-evidence.use-case';
import type { ReportEvidenceStorageService } from '../../../src/modules/reports/application/ports/report-evidence-storage.service';
import type {
  ReportRecord,
  ReportsRepository,
} from '../../../src/modules/reports/application/ports/reports.repository';
import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';

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

function createStorageServiceMock(): jest.Mocked<ReportEvidenceStorageService> {
  return {
    storeEvidence: jest.fn(),
    readEvidence: jest.fn(),
  };
}

function buildReportRecord(overrides: Partial<ReportRecord> = {}): ReportRecord {
  return {
    id: 'report-1',
    tripId: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    reporterMembershipId: 'membership-reporter',
    reporterUserId: 'user-reporter',
    reporterFullName: 'Reportero Uno',
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
    evidenceFileKey: 'evidence-123.png',
    reviewNote: null,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewedByFullName: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('GetReportEvidenceUseCase', () => {
  it('throws NotFoundException if report is not found', async () => {
    const repository = createReportsRepositoryMock();
    const storage = createStorageServiceMock();
    const useCase = new GetReportEvidenceUseCase(repository, storage);

    repository.findReportById.mockResolvedValue(null);

    const currentUser: CurrentUserContext = {
      id: 'user-1',
      email: 'test@uta.edu.ec',
      fullName: 'Test',
      globalRole: GlobalUserRole.User,
      accountStatus: 'ACTIVE' as any,
      memberships: [],
    };

    await expect(useCase.execute(currentUser, 'report-1')).rejects.toThrow(
      new NotFoundException('El reporte indicado no existe.'),
    );
  });

  it('allows SuperAdmin to read evidence', async () => {
    const repository = createReportsRepositoryMock();
    const storage = createStorageServiceMock();
    const useCase = new GetReportEvidenceUseCase(repository, storage);

    const report = buildReportRecord({ evidenceFileKey: 'key-1' });
    repository.findReportById.mockResolvedValue(report);
    storage.readEvidence.mockResolvedValue({
      fileName: 'evidence.png',
      mimeType: 'image/png',
      content: Buffer.from('mock-data'),
    });

    const currentUser: CurrentUserContext = {
      id: 'super-admin-1',
      email: 'admin@saferidepro.com',
      fullName: 'SuperAdmin',
      globalRole: GlobalUserRole.SuperAdmin,
      accountStatus: 'ACTIVE' as any,
      memberships: [],
    };

    const result = await useCase.execute(currentUser, 'report-1');

    expect(storage.readEvidence).toHaveBeenCalledWith('key-1');
    expect(result.mimeType).toBe('image/png');
  });

  it('allows the reporter or reported user to read evidence', async () => {
    const repository = createReportsRepositoryMock();
    const storage = createStorageServiceMock();
    const useCase = new GetReportEvidenceUseCase(repository, storage);

    const report = buildReportRecord({
      reporterUserId: 'user-reporter',
      reportedUserId: 'user-reported',
      evidenceFileKey: 'key-2',
    });
    repository.findReportById.mockResolvedValue(report);
    storage.readEvidence.mockResolvedValue({
      fileName: 'evidence.png',
      mimeType: 'image/png',
      content: Buffer.from('mock-data'),
    });

    const currentUser: CurrentUserContext = {
      id: 'user-reporter',
      email: 'reporter@uta.edu.ec',
      fullName: 'Reporter',
      globalRole: GlobalUserRole.User,
      accountStatus: 'ACTIVE' as any,
      memberships: [],
    };

    const result = await useCase.execute(currentUser, 'report-1');
    expect(storage.readEvidence).toHaveBeenCalledWith('key-2');
  });

  it('allows active institution admin of matching institution to read evidence', async () => {
    const repository = createReportsRepositoryMock();
    const storage = createStorageServiceMock();
    const useCase = new GetReportEvidenceUseCase(repository, storage);

    const report = buildReportRecord({
      institutionId: 'institution-1',
      evidenceFileKey: 'key-3',
    });
    repository.findReportById.mockResolvedValue(report);
    storage.readEvidence.mockResolvedValue({
      fileName: 'evidence.png',
      mimeType: 'image/png',
      content: Buffer.from('mock-data'),
    });

    const currentUser: CurrentUserContext = {
      id: 'admin-1',
      email: 'admin@uta.edu.ec',
      fullName: 'Admin UTA',
      globalRole: GlobalUserRole.User,
      accountStatus: 'ACTIVE' as any,
      memberships: [
        {
          id: 'membership-admin',
          institutionId: 'institution-1',
          institutionName: 'UTA',
          institutionIsActive: true,
          role: InstitutionMembershipRole.InstitutionAdmin,
          membershipStatus: MembershipStatus.Active,
          studentCode: '001',
          isDefault: true,
          driverVerificationStatus: 'NOT_REQUESTED' as any,
        },
      ],
    };

    const result = await useCase.execute(currentUser, 'report-1');
    expect(storage.readEvidence).toHaveBeenCalledWith('key-3');
  });

  it('forbids access if user is not authorized', async () => {
    const repository = createReportsRepositoryMock();
    const storage = createStorageServiceMock();
    const useCase = new GetReportEvidenceUseCase(repository, storage);

    const report = buildReportRecord({
      reporterUserId: 'user-reporter',
      reportedUserId: 'user-reported',
      institutionId: 'institution-1',
    });
    repository.findReportById.mockResolvedValue(report);

    const currentUser: CurrentUserContext = {
      id: 'stranger-1',
      email: 'stranger@uta.edu.ec',
      fullName: 'Stranger',
      globalRole: GlobalUserRole.User,
      accountStatus: 'ACTIVE' as any,
      memberships: [],
    };

    await expect(useCase.execute(currentUser, 'report-1')).rejects.toThrow(
      new ForbiddenException('No tienes permisos para acceder a la evidencia de este reporte.'),
    );
  });

  it('throws NotFoundException if report has no evidence file key attached', async () => {
    const repository = createReportsRepositoryMock();
    const storage = createStorageServiceMock();
    const useCase = new GetReportEvidenceUseCase(repository, storage);

    const report = buildReportRecord({
      reporterUserId: 'user-reporter',
      evidenceFileKey: null,
    });
    repository.findReportById.mockResolvedValue(report);

    const currentUser: CurrentUserContext = {
      id: 'user-reporter',
      email: 'reporter@uta.edu.ec',
      fullName: 'Reporter',
      globalRole: GlobalUserRole.User,
      accountStatus: 'ACTIVE' as any,
      memberships: [],
    };

    await expect(useCase.execute(currentUser, 'report-1')).rejects.toThrow(
      new NotFoundException('El reporte no tiene evidencia adjunta.'),
    );
  });
});
