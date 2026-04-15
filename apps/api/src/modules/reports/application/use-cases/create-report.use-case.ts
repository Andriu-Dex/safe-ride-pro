import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  deriveTripClosureIncidentType,
  MembershipStatus,
  TripClosureIncidentType,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import {
  REPORTS_REPOSITORY,
  ReportsRepository,
} from '../ports/reports.repository';

export type CreateReportCommand = {
  userId: string;
  tripId: string;
  reportedMembershipId: string;
  reason: string;
  description?: string;
  evidenceFileKey?: string;
};

@Injectable()
export class CreateReportUseCase {
  constructor(
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: CreateReportCommand) {
    const membership = await this.reportsRepository.findDefaultMembershipByUserId(command.userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para registrar reportes.');
    }

    const trip = await this.reportsRepository.findTripById(command.tripId);

    if (!trip) {
      throw new NotFoundException('El viaje indicado no existe.');
    }

    if (trip.institutionId !== membership.institutionId) {
      throw new ForbiddenException('Solo puedes reportar viajes de tu institucion activa.');
    }

    const incidentType = deriveTripClosureIncidentType({
      status: trip.status,
      departureAt: trip.departureAt,
      estimatedArrivalAt: trip.estimatedArrivalAt,
      cancelledAt: trip.cancelledAt,
    });

    if (!incidentType) {
      throw new BadRequestException(
        'Solo puedes reportar viajes cerrados o incidentes de cierre dentro de la ventana vigente.',
      );
    }

    if (command.reportedMembershipId === membership.id) {
      throw new BadRequestException('No puedes reportarte a ti mismo.');
    }

    const reporterIsDriver = trip.driverMembershipId === membership.id;
    const reporterIsAcceptedPassenger = await this.reportsRepository.hasAcceptedTripRequest(
      trip.id,
      membership.id,
    );

    if (!reporterIsDriver && !reporterIsAcceptedPassenger) {
      throw new ForbiddenException('No participaste en este viaje como conductor o pasajero confirmado.');
    }

    const reportedIsDriver = trip.driverMembershipId === command.reportedMembershipId;

    if (
      incidentType === TripClosureIncidentType.DriverAbsence ||
      incidentType === TripClosureIncidentType.LateDriverCancellation
    ) {
      if (!reporterIsAcceptedPassenger) {
        throw new ForbiddenException(
          'Solo los pasajeros confirmados pueden reportar al conductor por cancelacion tardia o ausencia.',
        );
      }

      if (!reportedIsDriver) {
        throw new BadRequestException(
          'En incidentes de cancelacion tardia o ausencia solo puedes reportar al conductor del viaje.',
        );
      }
    } else {
      const reportedIsAcceptedPassenger = await this.reportsRepository.hasAcceptedTripRequest(
        trip.id,
        command.reportedMembershipId,
      );

      if (!reportedIsDriver && !reportedIsAcceptedPassenger) {
        throw new BadRequestException(
          'Solo puedes reportar a participantes confirmados de este viaje.',
        );
      }
    }

    const existingReport = await this.reportsRepository.findExistingReport(
      trip.id,
      membership.id,
      command.reportedMembershipId,
    );

    if (existingReport) {
      throw new BadRequestException('Ya registraste un reporte para esta persona en el viaje indicado.');
    }

    const report = await this.reportsRepository.createReport({
      tripId: trip.id,
      reporterMembershipId: membership.id,
      reportedMembershipId: command.reportedMembershipId,
      reason: command.reason.trim(),
      description: command.description?.trim() || undefined,
      evidenceFileKey: command.evidenceFileKey?.trim() || undefined,
    });

    await this.auditService.record({
      institutionId: membership.institutionId,
      actorUserId: command.userId,
      action: AuditAction.ReportCreated,
      entityType: AuditEntityType.Report,
      entityId: report.id,
      metadata: {
        tripId: trip.id,
        reportedMembershipId: command.reportedMembershipId,
      },
    });

    return {
      message: 'Reporte registrado correctamente.',
      report,
    };
  }
}
