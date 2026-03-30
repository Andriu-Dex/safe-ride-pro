import { ForbiddenException } from '@nestjs/common';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
} from '@saferidepro/shared-types';

import type { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';

export function resolveAccessibleSanctionsInstitutionIds(
  currentUser: CurrentUserContext,
): string[] {
  return currentUser.memberships
    .filter(
      (membership) =>
        membership.role === InstitutionMembershipRole.InstitutionAdmin &&
        isOperationalMembership(membership),
    )
    .map((membership) => membership.institutionId);
}

export function resolveReviewableInstitutionScope(
  currentUser: CurrentUserContext,
  institutionId?: string,
): string[] | undefined {
  const accessibleInstitutionIds = resolveAccessibleSanctionsInstitutionIds(currentUser);

  if (
    currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
    accessibleInstitutionIds.length === 0
  ) {
    throw new ForbiddenException('No tienes permisos para gestionar sanciones.');
  }

  if (
    institutionId &&
    currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
    !accessibleInstitutionIds.includes(institutionId)
  ) {
    throw new ForbiddenException('No tienes permisos para gestionar sanciones de esa institucion.');
  }

  if (currentUser.globalRole === GlobalUserRole.SuperAdmin) {
    return institutionId ? [institutionId] : undefined;
  }

  return institutionId ? [institutionId] : accessibleInstitutionIds;
}
