import { MembershipStatus } from '@saferidepro/shared-types';
import { describe, expect, it } from 'vitest';

import { getOperationalAccessState } from './operational-context';
import type { AuthMembership } from '../types/auth-session';

function buildMembership(overrides?: Partial<AuthMembership>): AuthMembership {
  return {
    id: 'membership-1',
    institutionId: 'institution-1',
    institutionName: 'UTA',
    institutionIsActive: true,
    role: 'STUDENT' as AuthMembership['role'],
    membershipStatus: MembershipStatus.Active,
    studentCode: 'STU-001',
    isDefault: true,
    driverVerificationStatus: 'NOT_REQUESTED' as AuthMembership['driverVerificationStatus'],
    ...overrides,
  };
}

describe('getOperationalAccessState', () => {
  it('returns the operational membership when the session is usable', () => {
    const result = getOperationalAccessState([buildMembership()]);

    expect(result.hasOperationalMembership).toBe(true);
    expect(result.operationalMembership?.institutionName).toBe('UTA');
    expect(result.message).toBeNull();
  });

  it('returns an inactive-institution message when no institution is operational', () => {
    const result = getOperationalAccessState([
      buildMembership({
        institutionIsActive: false,
      }),
    ]);

    expect(result.hasOperationalMembership).toBe(false);
    expect(result.title).toBe('Institucion no operativa');
  });

  it('returns an inactive-membership message when no membership is active', () => {
    const result = getOperationalAccessState([
      buildMembership({
        membershipStatus: MembershipStatus.Inactive,
      }),
    ]);

    expect(result.hasOperationalMembership).toBe(false);
    expect(result.title).toBe('Membresia inactiva');
  });
});
