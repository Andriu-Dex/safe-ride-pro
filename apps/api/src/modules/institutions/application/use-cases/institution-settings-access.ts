import { ForbiddenException } from '@nestjs/common';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';

function getActiveInstitutionIds(currentUser: CurrentUserContext): string[] {
  return currentUser.memberships
    .filter(
      (membership) =>
        membership.membershipStatus === MembershipStatus.Active &&
        membership.institutionIsActive !== false,
    )
    .map((membership) => membership.institutionId);
}

function getManagedInstitutionIds(currentUser: CurrentUserContext): string[] {
  return currentUser.memberships
    .filter(
      (membership) =>
        membership.role === InstitutionMembershipRole.InstitutionAdmin &&
        membership.membershipStatus === MembershipStatus.Active &&
        membership.institutionIsActive !== false,
    )
    .map((membership) => membership.institutionId);
}

export function resolveReadableInstitutionId(
  currentUser: CurrentUserContext,
  requestedInstitutionId?: string,
): string {
  if (currentUser.globalRole === GlobalUserRole.SuperAdmin) {
    const fallbackInstitutionId =
      currentUser.memberships.find(
        (membership) =>
          membership.membershipStatus === MembershipStatus.Active &&
          membership.institutionIsActive !== false,
      )?.institutionId ?? currentUser.memberships[0]?.institutionId;

    const institutionId = requestedInstitutionId ?? fallbackInstitutionId;

    if (!institutionId) {
      throw new ForbiddenException(
        'Debes indicar una institucion valida para consultar esta configuracion.',
      );
    }

    return institutionId;
  }

  const readableInstitutionIds = getActiveInstitutionIds(currentUser);

  if (!readableInstitutionIds.length) {
    throw new ForbiddenException(
      'No tienes una membresia institucional activa para consultar configuraciones.',
    );
  }

  const institutionId =
    requestedInstitutionId ??
    currentUser.memberships.find(
      (membership) =>
        membership.membershipStatus === MembershipStatus.Active &&
        membership.institutionIsActive !== false,
    )?.institutionId ??
    readableInstitutionIds[0];

  if (!institutionId || !readableInstitutionIds.includes(institutionId)) {
    throw new ForbiddenException(
      'No tienes acceso a la configuracion de la institucion solicitada.',
    );
  }

  return institutionId;
}

export function resolveManagedInstitutionId(
  currentUser: CurrentUserContext,
  requestedInstitutionId?: string,
): string {
  if (currentUser.globalRole === GlobalUserRole.SuperAdmin) {
    return resolveReadableInstitutionId(currentUser, requestedInstitutionId);
  }

  const managedInstitutionIds = getManagedInstitutionIds(currentUser);

  if (!managedInstitutionIds.length) {
    throw new ForbiddenException(
      'Solo un administrador institucional puede actualizar esta configuracion.',
    );
  }

  const institutionId =
    requestedInstitutionId ??
    currentUser.memberships.find(
      (membership) =>
        membership.role === InstitutionMembershipRole.InstitutionAdmin &&
        membership.membershipStatus === MembershipStatus.Active &&
        membership.institutionIsActive !== false,
    )?.institutionId ??
    managedInstitutionIds[0];

  if (!institutionId || !managedInstitutionIds.includes(institutionId)) {
    throw new ForbiddenException(
      'No puedes modificar la configuracion de una institucion fuera de tu alcance.',
    );
  }

  return institutionId;
}
