import {
  MembershipStatus,
  ReportStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import { CreateReportUseCase } from '../../../src/modules/reports/application/use-cases/create-report.use-case';
import type {
  CreateReportInput,
  ReportRecord,
  ReportsRepository,
} from '../../../src/modules/reports/application/ports/reports.repository';

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

function buildCreatedReport(input: CreateReportInput): ReportRecord {
  return {
    id: 'report-1',
    tripId: input.tripId,
    institutionId: 'institution-1',
    institutionName: 'UTA',
    reporterMembershipId: input.reporterMembershipId,
    reporterUserId: 'user-passenger',
    reporterFullName: 'Pasajero Uno',
    reportedMembershipId: input.reportedMembershipId,
    reportedUserId: 'user-driver',
    reportedFullName: 'Conductor Uno',
    tripStatus: TripStatus.Completed,
    tripOriginLabel: 'Huachi',
    tripDestinationLabel: 'Centro',
    tripDepartureAt: new Date('2030-01-01T10:00:00.000Z'),
    status: ReportStatus.Pending,
    reason: input.reason,
    description: input.description ?? null,
    evidenceFileKey: input.evidenceFileKey ?? null,
    reviewNote: null,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewedByFullName: null,
    createdAt: new Date('2030-01-01T12:00:00.000Z'),
    updatedAt: new Date('2030-01-01T12:00:00.000Z'),
  };
}

describe('CreateReportUseCase', () => {
  it('creates a report and records an audit event', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const useCase = new CreateReportUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-passenger',
      userId: 'user-passenger',
      fullName: 'Pasajero Uno',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      status: TripStatus.Completed,
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-driver',
      driverFullName: 'Conductor Uno',
      originLabel: 'Huachi',
      destinationLabel: 'Centro',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
    });
    repository.hasAcceptedTripRequest.mockResolvedValue(true);
    repository.findExistingReport.mockResolvedValue(null);
    repository.createReport.mockImplementation(async (input) => buildCreatedReport(input));

    const response = await useCase.execute({
      userId: 'user-passenger',
      tripId: 'trip-1',
      reportedMembershipId: 'membership-driver',
      reason: 'UNSAFE_DRIVING',
      description: '  Se salto una parada confirmada  ',
    });

    expect(response.message).toBe('Reporte registrado correctamente.');
    expect(repository.createReport).toHaveBeenCalledWith({
      tripId: 'trip-1',
      reporterMembershipId: 'membership-passenger',
      reportedMembershipId: 'membership-driver',
      reason: 'UNSAFE_DRIVING',
      description: 'Se salto una parada confirmada',
      evidenceFileKey: undefined,
    });
    expect(auditService.record).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      actorUserId: 'user-passenger',
      action: AuditAction.ReportCreated,
      entityType: AuditEntityType.Report,
      entityId: 'report-1',
      metadata: {
        tripId: 'trip-1',
        reportedMembershipId: 'membership-driver',
      },
    });
  });
});
