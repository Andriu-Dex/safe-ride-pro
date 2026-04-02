import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { DRIVERS_REPOSITORY, DriversRepository } from '../ports/drivers.repository';

export type ListReviewableDriverApplicationsCommand = {
  currentUser: CurrentUserContext;
  institutionId?: string;
  status?: DriverVerificationStatus;
  limit?: number;
};

@Injectable()
export class ListReviewableDriverApplicationsUseCase {
  constructor(
    @Inject(DRIVERS_REPOSITORY)
    private readonly driversRepository: DriversRepository,
  ) {}

  async execute(command: ListReviewableDriverApplicationsCommand) {
    const accessibleInstitutionIds = this.resolveAccessibleInstitutionIds(
      command.currentUser,
    );

    if (
      command.currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
      accessibleInstitutionIds.length === 0
    ) {
      throw new ForbiddenException(
        'No tienes permisos para revisar solicitudes de conductor.',
      );
    }

    if (
      command.institutionId &&
      command.currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
      !accessibleInstitutionIds.includes(command.institutionId)
    ) {
      throw new ForbiddenException(
        'No tienes permisos para revisar solicitudes de esa institucion.',
      );
    }

    const institutionIds =
      command.currentUser.globalRole === GlobalUserRole.SuperAdmin
        ? command.institutionId
          ? [command.institutionId]
          : undefined
        : command.institutionId
          ? [command.institutionId]
          : accessibleInstitutionIds;

    const items = await this.driversRepository.listReviewableDriverApplications({
      institutionIds,
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
