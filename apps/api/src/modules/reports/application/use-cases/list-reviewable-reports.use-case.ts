import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
  ReportStatus,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  REPORTS_REPOSITORY,
  ReportsRepository,
} from '../ports/reports.repository';

export type ListReviewableReportsCommand = {
  currentUser: CurrentUserContext;
  institutionId?: string;
  userId?: string;
  status?: ReportStatus;
  limit?: number;
};

@Injectable()
export class ListReviewableReportsUseCase {
  constructor(
    @Inject(REPORTS_REPOSITORY)
    private readonly reportsRepository: ReportsRepository,
  ) {}

  async execute(command: ListReviewableReportsCommand) {
    const accessibleInstitutionIds = this.resolveAccessibleInstitutionIds(command.currentUser);

    if (
      command.currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
      accessibleInstitutionIds.length === 0
    ) {
      throw new ForbiddenException('No tienes permisos para revisar reportes.');
    }

    if (
      command.institutionId &&
      command.currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
      !accessibleInstitutionIds.includes(command.institutionId)
    ) {
      throw new ForbiddenException('No tienes permisos para revisar reportes de esa institucion.');
    }

    const institutionIds =
      command.currentUser.globalRole === GlobalUserRole.SuperAdmin
        ? command.institutionId
          ? [command.institutionId]
          : undefined
        : command.institutionId
          ? [command.institutionId]
          : accessibleInstitutionIds;

    const items = await this.reportsRepository.listReviewableReports({
      institutionIds,
      userId: command.userId,
      status: command.status,
      limit: command.limit,
    });

    return {
      items,
    };
  }

  private resolveAccessibleInstitutionIds(currentUser: CurrentUserContext): string[] {
    return currentUser.memberships
      .filter(
        (membership) =>
          membership.role === InstitutionMembershipRole.InstitutionAdmin &&
          isOperationalMembership(membership),
      )
      .map((membership) => membership.institutionId);
  }
}
