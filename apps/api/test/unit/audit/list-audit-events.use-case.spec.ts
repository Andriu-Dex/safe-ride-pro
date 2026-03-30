import { ForbiddenException } from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import type { AuditRepository } from '../../../src/modules/audit/application/ports/audit.repository';
import { ListAuditEventsUseCase } from '../../../src/modules/audit/application/use-cases/list-audit-events.use-case';

function createAuditRepositoryMock(): jest.Mocked<AuditRepository> {
  return {
    createEvent: jest.fn(),
    listEvents: jest.fn(),
  };
}

function buildInstitutionAdminUser(
  institutionIsActive: boolean,
): CurrentUserContext {
  return {
    id: 'admin-1',
    email: 'admin@uta.edu.ec',
    fullName: 'Admin UTA',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-admin',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        institutionIsActive,
        role: InstitutionMembershipRole.InstitutionAdmin,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'ADMIN-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
  };
}

describe('ListAuditEventsUseCase', () => {
  it('forbids access when the admin membership belongs to an inactive institution', async () => {
    const repository = createAuditRepositoryMock();
    const useCase = new ListAuditEventsUseCase(repository);

    await expect(
      useCase.execute({
        currentUser: buildInstitutionAdminUser(false),
      }),
    ).rejects.toThrow(
      new ForbiddenException('No tienes permisos para consultar eventos de auditoria.'),
    );

    expect(repository.listEvents).not.toHaveBeenCalled();
  });
});
