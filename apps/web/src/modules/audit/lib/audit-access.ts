import {
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import type { AuthUser } from '../../auth/types/auth-session';

export function canAccessAudit(user?: Pick<AuthUser, 'globalRole' | 'memberships'> | null): boolean {
  if (!user) {
    return false;
  }

  if (user.globalRole === GlobalUserRole.SuperAdmin) {
    return true;
  }

  return user.memberships.some(
    (membership) =>
      membership.role === InstitutionMembershipRole.InstitutionAdmin &&
      membership.membershipStatus === MembershipStatus.Active &&
      membership.institutionIsActive !== false,
  );
}
