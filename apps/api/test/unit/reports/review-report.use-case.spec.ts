import { BadRequestException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  ReportStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { ReviewReportUseCase } from '../../../src/modules/reports/application/use-cases/review-report.use-case';
import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import type { ReportRecord, ReportsRepository } from '../../../src/modules/reports/application/ports/reports.repository';

function createReportsRepositoryMock(): jest.Mocked<ReportsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findTripById: jest.fn(),
    hasAcceptedTripRequest: jest.fn(),
    findReportById: jest.fn(),
    findExistingReport: jest.fn(),
    createReport: jest.fn(),
    listReportsByReporterMembershipId: jest.fn(),
    listReviewableReports: jest.fn(),
    reviewReport: jest.fn(),
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

function buildReport(status: ReportStatus): ReportRecord {
  return {
    id: 'report-1',
    tripId: 'trip-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    reporterMembershipId: 'membership-passenger',
    reporterUserId: 'user-passenger',
    reporterFullName: 'Pasajero Uno',
    reportedMembershipId: 'membership-driver',
    reportedUserId: 'user-driver',
    reportedFullName: 'Conductor Uno',
    tripStatus: TripStatus.Completed,
    tripOriginLabel: 'Huachi',
    tripDestinationLabel: 'Centro',
    tripDepartureAt: new Date('2030-01-01T10:00:00.000Z'),
    status,
    reason: 'UNSAFE_DRIVING',
    description: 'Detalle del incidente',
    evidenceFileKey: null,
    reviewNote: null,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewedByFullName: null,
    createdAt: new Date('2030-01-01T11:00:00.000Z'),
    updatedAt: new Date('2030-01-01T11:00:00.000Z'),
  };
}

describe('ReviewReportUseCase', () => {
  it('requires an administrative note to dismiss a report', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewReportUseCase(repository, auditService);

    repository.findReportById.mockResolvedValue(buildReport(ReportStatus.Pending));

    await expect(
      useCase.execute(buildAdminUser(), {
        reportId: 'report-1',
        status: ReportStatus.Dismissed,
      }),
    ).rejects.toThrow(
      new BadRequestException('Debes indicar el motivo para desestimar el reporte.'),
    );

    expect(repository.reviewReport).not.toHaveBeenCalled();
  });

  it('resolves a report and records an audit event', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewReportUseCase(repository, auditService);

    repository.findReportById.mockResolvedValue(buildReport(ReportStatus.Pending));
    repository.reviewReport.mockResolvedValue(buildReport(ReportStatus.Resolved));

    const response = await useCase.execute(buildAdminUser(), {
      reportId: 'report-1',
      status: ReportStatus.Resolved,
      reviewNote: 'Caso validado y gestionado',
    });

    expect(response.message).toBe('Reporte revisado correctamente.');
    expect(repository.reviewReport).toHaveBeenCalledWith({
      reportId: 'report-1',
      reviewerUserId: 'admin-1',
      status: ReportStatus.Resolved,
      reviewNote: 'Caso validado y gestionado',
    });
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'admin-1',
      action: AuditAction.ReportReviewed,
      entityType: AuditEntityType.Report,
      entityId: 'report-1',
      metadata: {
        previousStatus: ReportStatus.Pending,
        currentStatus: ReportStatus.Resolved,
      },
    });
  });
});
