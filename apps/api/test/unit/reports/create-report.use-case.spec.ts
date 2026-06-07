import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    hasReportableTripParticipation: jest.fn(),
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
    tripCompletedAt: new Date('2030-01-01T10:40:00.000Z'),
    tripClosureNote: null,
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
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });
    repository.hasReportableTripParticipation.mockResolvedValue(true);
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

  it('allows an accepted passenger to report the driver after a late cancellation', async () => {
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
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      status: TripStatus.Cancelled,
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-driver',
      driverFullName: 'Conductor Uno',
      originLabel: 'Huachi',
      destinationLabel: 'Centro',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      completedAt: null,
      cancelledAt: new Date('2030-01-01T09:50:00.000Z'),
    });
    repository.hasReportableTripParticipation.mockResolvedValue(true);
    repository.findExistingReport.mockResolvedValue(null);
    repository.createReport.mockImplementation(async (input) => buildCreatedReport(input));

    const response = await useCase.execute({
      userId: 'user-passenger',
      tripId: 'trip-2',
      reportedMembershipId: 'membership-driver',
      reason: 'NO_SHOW',
      description: 'El conductor cancelo muy tarde.',
    });

    expect(response.message).toBe('Reporte registrado correctamente.');
    expect(repository.createReport).toHaveBeenCalledWith({
      tripId: 'trip-2',
      reporterMembershipId: 'membership-passenger',
      reportedMembershipId: 'membership-driver',
      reason: 'NO_SHOW',
      description: 'El conductor cancelo muy tarde.',
      evidenceFileKey: undefined,
    });
  });

  it('rejects passenger reports for trips that closed outside the reporting window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2030-01-05T12:00:00.000Z'));

    try {
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
        estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
        completedAt: new Date('2030-01-01T10:40:00.000Z'),
        cancelledAt: null,
      });

      await expect(
        useCase.execute({
          userId: 'user-passenger',
          tripId: 'trip-1',
          reportedMembershipId: 'membership-driver',
          reason: 'UNSAFE_DRIVING',
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Solo puedes reportar viajes cerrados o incidentes de cierre dentro de la ventana vigente.',
        ),
      );

      expect(repository.createReport).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects reporting if reporter has no active membership', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new CreateReportUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-passenger',
      userId: 'user-passenger',
      fullName: 'Pasajero Uno',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Suspended,
    });

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        reportedMembershipId: 'membership-driver',
        reason: 'UNSAFE_DRIVING',
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes una membresia activa para registrar reportes.'));
  });

  it('rejects reporting if trip does not exist', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new CreateReportUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-passenger',
      userId: 'user-passenger',
      fullName: 'Pasajero Uno',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
    });
    repository.findTripById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-invalid',
        reportedMembershipId: 'membership-driver',
        reason: 'UNSAFE_DRIVING',
      }),
    ).rejects.toThrow(new NotFoundException('El viaje indicado no existe.'));
  });

  it('rejects reporting if trip belongs to a different institution', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
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
      institutionId: 'institution-other',
      institutionName: 'Other',
      status: TripStatus.Completed,
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-driver',
      driverFullName: 'Conductor Uno',
      originLabel: 'Huachi',
      destinationLabel: 'Centro',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        reportedMembershipId: 'membership-driver',
        reason: 'UNSAFE_DRIVING',
      }),
    ).rejects.toThrow(new ForbiddenException('Solo puedes reportar viajes de tu institucion activa.'));
  });

  it('rejects reporting oneself', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
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
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        reportedMembershipId: 'membership-passenger',
        reason: 'UNSAFE_DRIVING',
      }),
    ).rejects.toThrow(new BadRequestException('No puedes reportarte a ti mismo.'));
  });

  it('rejects reporting if reporter did not participate in the trip', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
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
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });
    repository.hasReportableTripParticipation.mockResolvedValue(false);

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        reportedMembershipId: 'membership-driver',
        reason: 'UNSAFE_DRIVING',
      }),
    ).rejects.toThrow(new ForbiddenException('No participaste en este viaje como conductor o pasajero confirmado.'));
  });

  it('rejects reporting driver absence if reporter is driver', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new CreateReportUseCase(repository, auditService);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-driver',
      userId: 'user-driver',
      fullName: 'Conductor Uno',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      status: TripStatus.Cancelled,
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-driver',
      driverFullName: 'Conductor Uno',
      originLabel: 'Huachi',
      destinationLabel: 'Centro',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      completedAt: null,
      cancelledAt: new Date('2030-01-01T09:50:00.000Z'), // late cancellation
    });
    repository.hasReportableTripParticipation.mockResolvedValue(false);

    await expect(
      useCase.execute({
        userId: 'user-driver',
        tripId: 'trip-2',
        reportedMembershipId: 'membership-passenger',
        reason: 'NO_SHOW',
      }),
    ).rejects.toThrow(new ForbiddenException('Solo los pasajeros confirmados pueden reportar al conductor por cancelacion tardia o ausencia.'));
  });

  it('rejects reporting driver absence if reported person is not driver', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
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
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      status: TripStatus.Cancelled,
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-driver',
      driverFullName: 'Conductor Uno',
      originLabel: 'Huachi',
      destinationLabel: 'Centro',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      completedAt: null,
      cancelledAt: new Date('2030-01-01T09:50:00.000Z'), // late cancellation
    });
    repository.hasReportableTripParticipation.mockResolvedValue(true);

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-2',
        reportedMembershipId: 'membership-other-passenger',
        reason: 'NO_SHOW',
      }),
    ).rejects.toThrow(new BadRequestException('En incidentes de cancelacion tardia o ausencia solo puedes reportar al conductor del viaje.'));
  });

  it('rejects reporting non-participants for other incident types', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
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
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });
    repository.hasReportableTripParticipation
      .mockResolvedValueOnce(true) // reporter has participation
      .mockResolvedValueOnce(false); // reported does not have participation

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        reportedMembershipId: 'membership-other-passenger',
        reason: 'UNSAFE_DRIVING',
      }),
    ).rejects.toThrow(new BadRequestException('Solo puedes reportar a participantes confirmados de este viaje.'));
  });

  it('rejects reporting if a report already exists for the same target on the trip', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
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
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });
    repository.hasReportableTripParticipation.mockResolvedValue(true);
    repository.findExistingReport.mockResolvedValue({ id: 'report-existing' } as any);

    await expect(
      useCase.execute({
        userId: 'user-passenger',
        tripId: 'trip-1',
        reportedMembershipId: 'membership-driver',
        reason: 'UNSAFE_DRIVING',
      }),
    ).rejects.toThrow(new BadRequestException('Ya registraste un reporte para esta persona en el viaje indicado.'));
  });

  it('creates a report successfully without description or evidence file key', async () => {
    const repository = createReportsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
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
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      completedAt: new Date('2030-01-01T10:40:00.000Z'),
      cancelledAt: null,
    });
    repository.hasReportableTripParticipation.mockResolvedValue(true);
    repository.findExistingReport.mockResolvedValue(null);
    repository.createReport.mockImplementation(async (input) => buildCreatedReport(input));

    const response = await useCase.execute({
      userId: 'user-passenger',
      tripId: 'trip-1',
      reportedMembershipId: 'membership-driver',
      reason: 'UNSAFE_DRIVING',
    });

    expect(response.message).toBe('Reporte registrado correctamente.');
    expect(repository.createReport).toHaveBeenCalledWith({
      tripId: 'trip-1',
      reporterMembershipId: 'membership-passenger',
      reportedMembershipId: 'membership-driver',
      reason: 'UNSAFE_DRIVING',
      description: undefined,
      evidenceFileKey: undefined,
    });
  });
});
