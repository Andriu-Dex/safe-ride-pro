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
import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';

function createAuditRepositoryMock(): jest.Mocked<AuditRepository> {
  return {
    createEvent: jest.fn(),
    listEvents: jest.fn(),
  };
}

function buildInstitutionAdminUser(
  institutionIsActive: boolean,
  institutionId = 'institution-1',
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
        institutionId,
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

function buildSuperAdminUser(): CurrentUserContext {
  return {
    id: 'superadmin-1',
    email: 'superadmin@saferidepro.com',
    fullName: 'Super Admin',
    globalRole: GlobalUserRole.SuperAdmin,
    accountStatus: AccountStatus.Active,
    memberships: [],
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

  it('forbids access when non-superadmin has no memberships', async () => {
    const repository = createAuditRepositoryMock();
    const useCase = new ListAuditEventsUseCase(repository);

    await expect(
      useCase.execute({
        currentUser: {
          id: 'user-1',
          email: 'user@test.com',
          fullName: 'User Test',
          globalRole: GlobalUserRole.User,
          accountStatus: AccountStatus.Active,
          memberships: [],
        },
      }),
    ).rejects.toThrow(
      new ForbiddenException('No tienes permisos para consultar eventos de auditoria.'),
    );
  });

  it('forbids access when querying another institution ID not allowed by memberships', async () => {
    const repository = createAuditRepositoryMock();
    const useCase = new ListAuditEventsUseCase(repository);

    await expect(
      useCase.execute({
        currentUser: buildInstitutionAdminUser(true, 'institution-1'),
        institutionId: 'institution-different',
      }),
    ).rejects.toThrow(
      new ForbiddenException('No tienes permisos para consultar auditoria de esa institucion.'),
    );
  });

  it('allows SuperAdmin to retrieve all events or specify any institutionId', async () => {
    const repository = createAuditRepositoryMock();
    const useCase = new ListAuditEventsUseCase(repository);
    const mockEvents = [{ id: 'event-1' }];
    repository.listEvents.mockResolvedValue(mockEvents as any);

    // Call without institutionId
    let result = await useCase.execute({
      currentUser: buildSuperAdminUser(),
    });
    expect(result.items).toEqual(mockEvents);
    expect(repository.listEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({
        institutionIds: undefined,
      }),
    );

    // Call with institutionId
    result = await useCase.execute({
      currentUser: buildSuperAdminUser(),
      institutionId: 'any-institution-id',
    });
    expect(result.items).toEqual(mockEvents);
    expect(repository.listEvents).toHaveBeenLastCalledWith(
      expect.objectContaining({
        institutionIds: ['any-institution-id'],
      }),
    );
  });

  it('allows regular active institution admin to query and filter with valid dates and other arguments', async () => {
    const repository = createAuditRepositoryMock();
    const useCase = new ListAuditEventsUseCase(repository);
    const mockEvents = [{ id: 'event-1' }];
    repository.listEvents.mockResolvedValue(mockEvents as any);

    const result = await useCase.execute({
      currentUser: buildInstitutionAdminUser(true, 'institution-1'),
      institutionId: 'institution-1',
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-05T00:00:00.000Z',
      actorUserId: 'actor-1',
      action: AuditAction.AuthLoginSucceeded,
      entityType: AuditEntityType.AuthSession,
      limit: 10,
    });

    expect(result.items).toEqual(mockEvents);
    expect(repository.listEvents).toHaveBeenCalledWith({
      institutionIds: ['institution-1'],
      actorUserId: 'actor-1',
      action: AuditAction.AuthLoginSucceeded,
      entityType: AuditEntityType.AuthSession,
      from: new Date('2026-06-01T00:00:00.000Z'),
      to: new Date('2026-06-05T00:00:00.000Z'),
      limit: 10,
    });
  });

  it('ignores invalid from/to dates by mapping them to undefined', async () => {
    const repository = createAuditRepositoryMock();
    const useCase = new ListAuditEventsUseCase(repository);
    repository.listEvents.mockResolvedValue([]);

    await useCase.execute({
      currentUser: buildInstitutionAdminUser(true, 'institution-1'),
      from: 'invalid-date',
      to: 'invalid-date',
    });

    expect(repository.listEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        from: undefined,
        to: undefined,
      }),
    );
  });
});
