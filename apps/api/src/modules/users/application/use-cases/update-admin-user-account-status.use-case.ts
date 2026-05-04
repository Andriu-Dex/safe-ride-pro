import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  AccountStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  USERS_REPOSITORY,
  UsersRepository,
} from '../ports/users.repository';

export type UpdateAdminUserAccountStatusCommand = {
  currentUser: CurrentUserContext;
  userId: string;
  accountStatus: AccountStatus;
};

@Injectable()
export class UpdateAdminUserAccountStatusUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(command: UpdateAdminUserAccountStatusCommand) {
    if (command.currentUser.id === command.userId) {
      throw new ForbiddenException('No puedes modificar el estado de tu propia cuenta.');
    }

    const targetUser = await this.usersRepository.findById(command.userId);

    if (!targetUser) {
      throw new ForbiddenException('El usuario solicitado no existe o no es accesible.');
    }

    const accessibleInstitutionIds = this.resolveAccessibleInstitutionIds(command.currentUser);

    if (
      command.currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
      accessibleInstitutionIds.length === 0
    ) {
      throw new ForbiddenException('No tienes permisos para gestionar usuarios.');
    }

    const targetInstitutionIds = targetUser.memberships.map((membership) => membership.institutionId);
    const isTargetAccessible =
      command.currentUser.globalRole === GlobalUserRole.SuperAdmin ||
      targetInstitutionIds.some((institutionId) => accessibleInstitutionIds.includes(institutionId));

    if (!isTargetAccessible) {
      throw new ForbiddenException('No tienes permisos para modificar este usuario.');
    }

    const targetHasAdminMembership = targetUser.memberships.some(
      (membership) => membership.role === InstitutionMembershipRole.InstitutionAdmin,
    );

    if (
      targetHasAdminMembership &&
      command.currentUser.globalRole !== GlobalUserRole.SuperAdmin
    ) {
      throw new ForbiddenException('Solo superadministracion puede modificar cuentas administrativas.');
    }

    const updatedUser = await this.usersRepository.updateAccountStatus(
      command.userId,
      command.accountStatus,
    );

    return {
      message:
        command.accountStatus === AccountStatus.Suspended
          ? 'La cuenta fue bloqueada correctamente.'
          : 'La cuenta fue reactivada correctamente.',
      user: updatedUser,
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
