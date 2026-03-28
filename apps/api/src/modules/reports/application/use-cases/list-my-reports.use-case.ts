import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import {
  REPORTS_REPOSITORY,
  ReportsRepository,
} from '../ports/reports.repository';

@Injectable()
export class ListMyReportsUseCase {
  constructor(
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
  ) {}

  async execute(userId: string) {
    const membership = await this.reportsRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para consultar reportes.');
    }

    const items = await this.reportsRepository.listReportsByReporterMembershipId(membership.id);

    return {
      items,
    };
  }
}