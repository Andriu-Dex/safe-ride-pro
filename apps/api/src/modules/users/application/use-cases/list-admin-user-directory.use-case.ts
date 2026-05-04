import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  USERS_REPOSITORY,
  UsersRepository,
} from '../ports/users.repository';

export type ListAdminUserDirectoryCommand = {
  currentUser: CurrentUserContext;
  institutionId?: string;
  query?: string;
  accountStatus?: AccountStatus;
  driverVerificationStatus?: DriverVerificationStatus;
  limit?: number;
};

@Injectable()
export class ListAdminUserDirectoryUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(command: ListAdminUserDirectoryCommand) {
    const institutionIds = this.resolveInstitutionScope(
      command.currentUser,
      command.institutionId,
    );

    const items = await this.usersRepository.listAdminUserDirectory({
      institutionIds,
      query: command.query,
      accountStatus: command.accountStatus,
      driverVerificationStatus: command.driverVerificationStatus,
      limit: command.limit,
    });

    return {
      items,
    };
  }

  private resolveInstitutionScope(
    currentUser: CurrentUserContext,
    institutionId?: string,
  ): string[] | undefined {
    const accessibleInstitutionIds = currentUser.memberships
      .filter(
        (membership) =>
          membership.role === InstitutionMembershipRole.InstitutionAdmin &&
          isOperationalMembership(membership),
      )
      .map((membership) => membership.institutionId);

    if (
      currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
      accessibleInstitutionIds.length === 0
    ) {
      throw new ForbiddenException('No tienes permisos para gestionar usuarios.');
    }

    if (
      institutionId &&
      currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
      !accessibleInstitutionIds.includes(institutionId)
    ) {
      throw new ForbiddenException('No tienes permisos para gestionar usuarios de esa institucion.');
    }

    if (currentUser.globalRole === GlobalUserRole.SuperAdmin) {
      return institutionId ? [institutionId] : undefined;
    }

    return institutionId ? [institutionId] : accessibleInstitutionIds;
  }
}
