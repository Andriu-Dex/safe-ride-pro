type OperationalMembershipLike = {
  isDefault?: boolean;
  membershipStatus?: string | null;
  institutionIsActive?: boolean | null;
};

export function isOperationalMembership(
  membership: OperationalMembershipLike | null | undefined,
): boolean {
  if (!membership) {
    return false;
  }

  return membership.membershipStatus === 'ACTIVE' && membership.institutionIsActive !== false;
}

export function selectOperationalMembership<T extends OperationalMembershipLike>(
  memberships: readonly T[] | null | undefined,
): T | undefined {
  if (!memberships?.length) {
    return undefined;
  }

  return (
    memberships.find(
      (membership) => membership.isDefault && isOperationalMembership(membership),
    ) ??
    memberships.find((membership) => isOperationalMembership(membership)) ??
    memberships.find((membership) => membership.isDefault) ??
    memberships[0]
  );
}
