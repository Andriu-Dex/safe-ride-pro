import {
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';
import { describe, expect, it } from 'vitest';

import { canAccessAudit } from './audit-access';

describe('canAccessAudit', () => {
  it('allows super admin users', () => {
    expect(
      canAccessAudit({
        globalRole: GlobalUserRole.SuperAdmin,
        memberships: [],
      } as never),
    ).toBe(true);
  });

  it('allows active institution admins', () => {
    expect(
      canAccessAudit({
        globalRole: GlobalUserRole.User,
        memberships: [
          {
            institutionIsActive: true,
            membershipStatus: MembershipStatus.Active,
            role: InstitutionMembershipRole.InstitutionAdmin,
          },
        ],
      } as never),
    ).toBe(true);
  });

  it('rejects regular students', () => {
    expect(
      canAccessAudit({
        globalRole: GlobalUserRole.User,
        memberships: [
          {
            institutionIsActive: true,
            membershipStatus: MembershipStatus.Active,
            role: InstitutionMembershipRole.Student,
          },
        ],
      } as never),
    ).toBe(false);
  });
});
