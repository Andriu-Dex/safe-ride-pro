import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
  ReportStatus,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import { OperationalSanctionsService } from '../../../sanctions/application/services/operational-sanctions.service';
import {
  REPORTS_REPOSITORY,
  ReportsRepository,
} from '../ports/reports.repository';

export type ReviewReportCommand = {
  reportId: string;
  status: ReportStatus;
  reviewNote?: string;
};

@Injectable()
export class ReviewReportUseCase {
  constructor(
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
    private readonly auditService: AuditService,
    private readonly operationalSanctionsService: OperationalSanctionsService,
  ) {}

  async execute(currentUser: CurrentUserContext, command: ReviewReportCommand) {
    const report = await this.reportsRepository.findReportById(command.reportId);

    if (!report) {
      throw new NotFoundException('El reporte indicado no existe.');
    }

    const canReview =
      currentUser.globalRole === GlobalUserRole.SuperAdmin ||
      currentUser.memberships.some(
        (membership) =>
          membership.institutionId === report.institutionId &&
          membership.role === InstitutionMembershipRole.InstitutionAdmin &&
          isOperationalMembership(membership),
      );

    if (!canReview) {
      throw new ForbiddenException('No tienes permisos para revisar reportes de esta institucion.');
    }

    const isInstitutionAdminReviewer = currentUser.globalRole !== GlobalUserRole.SuperAdmin;
    const hasConflictOfInterest =
      currentUser.id === report.reporterUserId || currentUser.id === report.reportedUserId;

    if (isInstitutionAdminReviewer && hasConflictOfInterest) {
      throw new ForbiddenException(
        'No puedes revisar un reporte en el que participas directamente.',
      );
    }

    if (report.status === ReportStatus.Resolved || report.status === ReportStatus.Dismissed) {
      throw new BadRequestException('El reporte ya fue cerrado y no puede cambiar de estado.');
    }

    if (command.status === ReportStatus.Pending) {
      throw new BadRequestException('No se puede volver a dejar el reporte en estado pendiente.');
    }

    if (report.status === command.status) {
      throw new BadRequestException('El reporte ya se encuentra en el estado indicado.');
    }

    const normalizedReviewNote = command.reviewNote?.trim();

    if (
      (command.status === ReportStatus.Resolved || command.status === ReportStatus.Dismissed) &&
      !normalizedReviewNote
    ) {
      throw new BadRequestException(
        'Debes indicar una nota administrativa antes de cerrar el reporte.',
      );
    }

    const previousStatus = report.status;

    const updatedReport = await this.reportsRepository.reviewReport({
      reportId: report.id,
      reviewerUserId: currentUser.id,
      status: command.status,
      reviewNote: normalizedReviewNote || undefined,
    });

    await this.auditService.record({
      institutionId: report.institutionId,
      actorUserId: currentUser.id,
      action: AuditAction.ReportReviewed,
      entityType: AuditEntityType.Report,
      entityId: report.id,
      metadata: {
        previousStatus,
        currentStatus: updatedReport.status,
      },
    });

    if (updatedReport.status === ReportStatus.Resolved) {
      await this.operationalSanctionsService.synchronizeAutomaticSanctions(
        updatedReport.reportedMembershipId,
      );
    }

    return {
      message: 'Reporte revisado correctamente.',
      report: updatedReport,
    };
  }
}
