import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  REPORT_EVIDENCE_STORAGE_SERVICE,
  ReportEvidenceStorageService,
} from '../ports/report-evidence-storage.service';
import {
  REPORTS_REPOSITORY,
  ReportsRepository,
} from '../ports/reports.repository';

@Injectable()
export class GetReportEvidenceUseCase {
  constructor(
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
    @Inject(REPORT_EVIDENCE_STORAGE_SERVICE)
    private readonly reportEvidenceStorageService: ReportEvidenceStorageService,
  ) {}

  async execute(currentUser: CurrentUserContext, reportId: string) {
    const report = await this.reportsRepository.findReportById(reportId);

    if (!report) {
      throw new NotFoundException('El reporte indicado no existe.');
    }

    const canAccess =
      currentUser.globalRole === GlobalUserRole.SuperAdmin ||
      currentUser.id === report.reporterUserId ||
      currentUser.id === report.reportedUserId ||
      currentUser.memberships.some(
        (membership) =>
          membership.institutionId === report.institutionId &&
          membership.role === InstitutionMembershipRole.InstitutionAdmin &&
          isOperationalMembership(membership),
      );

    if (!canAccess) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a la evidencia de este reporte.',
      );
    }

    if (!report.evidenceFileKey) {
      throw new NotFoundException('El reporte no tiene evidencia adjunta.');
    }

    return this.reportEvidenceStorageService.readEvidence(report.evidenceFileKey);
  }
}
