import { DriverVerificationStatus } from '@saferidepro/shared-types';

import { canAccessAudit } from '../../audit/lib/audit-access';
import type { AuthMembership, AuthUser } from '../types/auth-session';
import { getOperationalAccessState } from './operational-context';

export function isApprovedDriverMembership(
  membership?: Pick<
    AuthMembership,
    'driverVerificationStatus' | 'effectiveDriverVerificationStatus'
  > | null,
): boolean {
  if (!membership) {
    return false;
  }

  return (
    membership.effectiveDriverVerificationStatus === DriverVerificationStatus.Approved ||
    membership.driverVerificationStatus === DriverVerificationStatus.Approved
  );
}

export function getCurrentOperationalMembership(
  memberships: readonly AuthMembership[] | null | undefined,
): AuthMembership | undefined {
  const operationalAccess = getOperationalAccessState(memberships);

  return operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
}

export function canAccessDriverTools(user?: Pick<AuthUser, 'memberships'> | null): boolean {
  if (!user) {
    return false;
  }

  return user.memberships.some((membership) => isApprovedDriverMembership(membership));
}

export function hasStartedDriverFlow(user?: Pick<AuthUser, 'memberships'> | null): boolean {
  if (!user) {
    return false;
  }

  return user.memberships.some((membership) => {
    const effectiveStatus =
      membership.effectiveDriverVerificationStatus ?? membership.driverVerificationStatus;

    return effectiveStatus !== DriverVerificationStatus.NotRequested;
  });
}

export function canAccessDashboard(
  user?: Pick<AuthUser, 'globalRole' | 'memberships'> | null,
): boolean {
  if (!user) {
    return false;
  }

  return canAccessAudit(user) || canAccessDriverTools(user);
}
