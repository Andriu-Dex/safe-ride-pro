import { DriverVerificationStatus, MembershipStatus } from '@saferidepro/shared-types';
import { describe, expect, it } from 'vitest';

import {
  isApprovedDriverMembership,
  getCurrentOperationalMembership,
  canAccessDriverTools,
  hasStartedDriverFlow,
  canAccessDashboard,
} from './app-access';
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
    driverVerificationStatus: DriverVerificationStatus.NotRequested,
    effectiveDriverVerificationStatus: DriverVerificationStatus.NotRequested,
    ...overrides,
  };
}

describe('app-access', () => {
  describe('isApprovedDriverMembership', () => {
    it('returns false when membership is null or undefined', () => {
      expect(isApprovedDriverMembership(null)).toBe(false);
      expect(isApprovedDriverMembership(undefined)).toBe(false);
    });

    it('returns true when effectiveDriverVerificationStatus is Approved', () => {
      const membership = buildMembership({
        effectiveDriverVerificationStatus: DriverVerificationStatus.Approved,
      });
      expect(isApprovedDriverMembership(membership)).toBe(true);
    });

    it('returns true when driverVerificationStatus is Approved but effective is not', () => {
      const membership = buildMembership({
        effectiveDriverVerificationStatus: DriverVerificationStatus.PendingVerification,
        driverVerificationStatus: DriverVerificationStatus.Approved,
      });
      expect(isApprovedDriverMembership(membership)).toBe(true);
    });

    it('returns false when neither status is Approved', () => {
      const membership = buildMembership({
        effectiveDriverVerificationStatus: DriverVerificationStatus.PendingVerification,
        driverVerificationStatus: DriverVerificationStatus.PendingVerification,
      });
      expect(isApprovedDriverMembership(membership)).toBe(false);
    });
  });

  describe('getCurrentOperationalMembership', () => {
    it('returns operationalMembership if available', () => {
      const activeMembership = buildMembership({
        membershipStatus: MembershipStatus.Active,
        institutionIsActive: true,
      });
      const result = getCurrentOperationalMembership([activeMembership]);
      expect(result).toBeDefined();
      expect(result?.id).toBe(activeMembership.id);
    });

    it('returns selectedMembership if operationalMembership is null/undefined', () => {
      const inactiveMembership = buildMembership({
        membershipStatus: MembershipStatus.Inactive,
      });
      const result = getCurrentOperationalMembership([inactiveMembership]);
      expect(result).toBeDefined();
      expect(result?.id).toBe(inactiveMembership.id);
    });
  });

  describe('canAccessDriverTools', () => {
    it('returns false when user is null or undefined', () => {
      expect(canAccessDriverTools(null)).toBe(false);
      expect(canAccessDriverTools(undefined)).toBe(false);
    });

    it('returns true if any membership is an approved driver', () => {
      const user = {
        memberships: [
          buildMembership({ driverVerificationStatus: DriverVerificationStatus.PendingVerification }),
          buildMembership({ driverVerificationStatus: DriverVerificationStatus.Approved }),
        ],
      };
      expect(canAccessDriverTools(user)).toBe(true);
    });

    it('returns false if no membership is an approved driver', () => {
      const user = {
        memberships: [
          buildMembership({ driverVerificationStatus: DriverVerificationStatus.PendingVerification }),
        ],
      };
      expect(canAccessDriverTools(user)).toBe(false);
    });
  });

  describe('hasStartedDriverFlow', () => {
    it('returns false when user is null or undefined', () => {
      expect(hasStartedDriverFlow(null)).toBe(false);
      expect(hasStartedDriverFlow(undefined)).toBe(false);
    });

    it('returns true if any membership has started flow', () => {
      const user = {
        memberships: [
          buildMembership({
            driverVerificationStatus: DriverVerificationStatus.NotRequested,
            effectiveDriverVerificationStatus: DriverVerificationStatus.NotRequested,
          }),
          buildMembership({
            driverVerificationStatus: DriverVerificationStatus.PendingVerification,
            effectiveDriverVerificationStatus: DriverVerificationStatus.PendingVerification,
          }),
        ],
      };
      expect(hasStartedDriverFlow(user)).toBe(true);
    });

    it('returns false if no membership has started flow', () => {
      const user = {
        memberships: [
          buildMembership({
            driverVerificationStatus: DriverVerificationStatus.NotRequested,
            effectiveDriverVerificationStatus: DriverVerificationStatus.NotRequested,
          }),
        ],
      };
      expect(hasStartedDriverFlow(user)).toBe(false);
    });
  });

  describe('canAccessDashboard', () => {
    it('returns false when user is null or undefined', () => {
      expect(canAccessDashboard(null)).toBe(false);
      expect(canAccessDashboard(undefined)).toBe(false);
    });

    it('returns true if user has admin role (canAccessAudit)', () => {
      const { GlobalUserRole } = require('@saferidepro/shared-types');
      const user = {
        globalRole: GlobalUserRole.SuperAdmin,
        memberships: [],
      };
      expect(canAccessDashboard(user)).toBe(true);
    });

    it('returns true if user can access driver tools', () => {
      const user = {
        globalRole: 'PASSENGER' as any,
        memberships: [
          buildMembership({ driverVerificationStatus: DriverVerificationStatus.Approved }),
        ],
      };
      expect(canAccessDashboard(user)).toBe(true);
    });

    it('returns false if user is not admin and has no driver tools', () => {
      const user = {
        globalRole: 'PASSENGER' as any,
        memberships: [
          buildMembership({ driverVerificationStatus: DriverVerificationStatus.NotRequested }),
        ],
      };
      expect(canAccessDashboard(user)).toBe(false);
    });
  });
});
