import { ForbiddenException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import {
  resolveManagedInstitutionId,
  resolveReadableInstitutionId,
} from '../../../src/modules/institutions/application/use-cases/institution-settings-access';

function buildCurrentUser(
  overrides: Partial<CurrentUserContext> = {},
): CurrentUserContext {
  return {
    id: 'user-1',
    email: 'user@uta.edu.ec',
    fullName: 'Usuario Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [],
    ...overrides,
  };
}

function buildMembership(
  institutionId: string,
  overrides: Partial<CurrentUserContext['memberships'][number]> = {},
): CurrentUserContext['memberships'][number] {
  return {
    id: `membership-${institutionId}`,
    institutionId,
    institutionName: `Inst ${institutionId}`,
    institutionIsActive: true,
    role: InstitutionMembershipRole.Student,
    membershipStatus: MembershipStatus.Active,
    studentCode: 'STUDENT-001',
    isDefault: institutionId === 'inst-1',
    driverVerificationStatus: DriverVerificationStatus.NotRequested,
    ...overrides,
  };
}

describe('institution-settings-access', () => {
  describe('resolveReadableInstitutionId', () => {
    it('lets a super admin read any explicitly requested institution', () => {
      const currentUser = buildCurrentUser({
        globalRole: GlobalUserRole.SuperAdmin,
      });

      expect(resolveReadableInstitutionId(currentUser, 'inst-9')).toBe('inst-9');
    });

    it('falls back to the first active institution for super admins when none is requested', () => {
      const currentUser = buildCurrentUser({
        globalRole: GlobalUserRole.SuperAdmin,
        memberships: [
          buildMembership('inst-1', {
            membershipStatus: MembershipStatus.Suspended,
          }),
          buildMembership('inst-2'),
        ],
      });

      expect(resolveReadableInstitutionId(currentUser)).toBe('inst-2');
    });

    it('uses the first known membership for super admins when none are active', () => {
      const currentUser = buildCurrentUser({
        globalRole: GlobalUserRole.SuperAdmin,
        memberships: [
          buildMembership('inst-3', {
            membershipStatus: MembershipStatus.Suspended,
            institutionIsActive: false,
          }),
        ],
      });

      expect(resolveReadableInstitutionId(currentUser)).toBe('inst-3');
    });

    it('rejects regular users without active institutional memberships', () => {
      const currentUser = buildCurrentUser({
        memberships: [
          buildMembership('inst-1', {
            membershipStatus: MembershipStatus.Suspended,
          }),
        ],
      });

      expect(() => resolveReadableInstitutionId(currentUser)).toThrow(
        new ForbiddenException(
          'No tienes una membresia institucional activa para consultar configuraciones.',
        ),
      );
    });

    it('rejects access to institutions outside the active scope', () => {
      const currentUser = buildCurrentUser({
        memberships: [buildMembership('inst-1')],
      });

      expect(() => resolveReadableInstitutionId(currentUser, 'inst-2')).toThrow(
        new ForbiddenException(
          'No tienes acceso a la configuracion de la institucion solicitada.',
        ),
      );
    });

    it('returns the first readable active institution when no id is requested', () => {
      const currentUser = buildCurrentUser({
        memberships: [
          buildMembership('inst-1', {
            institutionIsActive: false,
          }),
          buildMembership('inst-2'),
          buildMembership('inst-3'),
        ],
      });

      expect(resolveReadableInstitutionId(currentUser)).toBe('inst-2');
    });
  });

  describe('resolveManagedInstitutionId', () => {
    it('delegates super admins to the readable institution logic', () => {
      const currentUser = buildCurrentUser({
        globalRole: GlobalUserRole.SuperAdmin,
        memberships: [buildMembership('inst-7')],
      });

      expect(resolveManagedInstitutionId(currentUser)).toBe('inst-7');
    });

    it('requires at least one active institutional-admin membership', () => {
      const currentUser = buildCurrentUser({
        memberships: [buildMembership('inst-1')],
      });

      expect(() => resolveManagedInstitutionId(currentUser)).toThrow(
        new ForbiddenException(
          'Solo un administrador institucional puede actualizar esta configuracion.',
        ),
      );
    });

    it('rejects modifications outside the managed scope', () => {
      const currentUser = buildCurrentUser({
        memberships: [
          buildMembership('inst-1', {
            role: InstitutionMembershipRole.InstitutionAdmin,
          }),
        ],
      });

      expect(() => resolveManagedInstitutionId(currentUser, 'inst-9')).toThrow(
        new ForbiddenException(
          'No puedes modificar la configuracion de una institucion fuera de tu alcance.',
        ),
      );
    });

    it('returns the active institution managed by the current admin', () => {
      const currentUser = buildCurrentUser({
        memberships: [
          buildMembership('inst-1', {
            role: InstitutionMembershipRole.InstitutionAdmin,
            membershipStatus: MembershipStatus.Suspended,
          }),
          buildMembership('inst-2', {
            role: InstitutionMembershipRole.InstitutionAdmin,
          }),
        ],
      });

      expect(resolveManagedInstitutionId(currentUser)).toBe('inst-2');
    });
  });
});
