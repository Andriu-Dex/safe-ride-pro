import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  ReportStatus,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
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
          membership.membershipStatus === MembershipStatus.Active,
      );

    if (!canReview) {
      throw new ForbiddenException('No tienes permisos para revisar reportes de esta institucion.');
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

    if (command.status === ReportStatus.Dismissed && !command.reviewNote?.trim()) {
      throw new BadRequestException('Debes indicar el motivo para desestimar el reporte.');
    }

    const previousStatus = report.status;

    const updatedReport = await this.reportsRepository.reviewReport({
      reportId: report.id,
      reviewerUserId: currentUser.id,
      status: command.status,
      reviewNote: command.reviewNote?.trim() || undefined,
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

    return {
      message: 'Reporte revisado correctamente.',
      report: updatedReport,
    };
  }
}
