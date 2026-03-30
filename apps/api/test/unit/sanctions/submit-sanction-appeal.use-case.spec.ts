import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
  OperationalSanctionAppealStatus,
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import type {
  OperationalSanctionDetailRecord,
  OperationalSanctionAppealRecord,
  SanctionsRepository,
} from '../../../src/modules/sanctions/application/ports/sanctions.repository';
import { SubmitSanctionAppealUseCase } from '../../../src/modules/sanctions/application/use-cases/submit-sanction-appeal.use-case';

function createSanctionsRepositoryMock(): jest.Mocked<SanctionsRepository> {
  return {
    findInstitutionIdByMembershipId: jest.fn(),
    getRecentMetrics: jest.fn(),
    getRecentSanctionHistory: jest.fn(),
    countRecentBlockingSanctionsByScope: jest.fn(),
    listActiveSanctions: jest.fn(),
    findSanctionDetailById: jest.fn(),
    listReviewableActiveSanctions: jest.fn(),
    expireElapsedSanctions: jest.fn(),
    expireSanction: jest.fn(),
    createOperationalSanction: jest.fn(),
    findAppealBySanctionId: jest.fn(),
    findAppealById: jest.fn(),
    createOperationalSanctionAppeal: jest.fn(),
    listAppealsByRequestedByUserId: jest.fn(),
    listReviewableOperationalSanctionAppeals: jest.fn(),
    reviewOperationalSanctionAppeal: jest.fn(),
  };
}

function buildCurrentUser(): CurrentUserContext {
  return {
    id: 'user-1',
    email: 'student@uta.edu.ec',
    fullName: 'Usuario Uno',
    globalRole: GlobalUserRole.User,
    accountStatus: AccountStatus.Active,
    memberships: [
      {
        id: 'membership-1',
        institutionId: 'institution-1',
        institutionName: 'UTA',
        institutionIsActive: true,
        role: InstitutionMembershipRole.Student,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'STU-001',
        isDefault: true,
        driverVerificationStatus: DriverVerificationStatus.NotRequested,
      },
    ],
  };
}

function buildSanction(overrides: Partial<OperationalSanctionDetailRecord> = {}): OperationalSanctionDetailRecord {
  return {
    id: 'sanction-1',
    membershipId: 'membership-1',
    type: OperationalSanctionType.LimitedPassenger,
    scope: OperationalSanctionScope.Passenger,
    status: OperationalSanctionStatus.Active,
    trigger: OperationalSanctionTrigger.PassengerNoShow,
    reason: 'Restriccion temporal por reincidencia.',
    isAutomatic: true,
    startedAt: new Date('2030-01-01T08:00:00.000Z'),
    endsAt: new Date('2030-01-08T08:00:00.000Z'),
    expiredAt: null,
    metadata: null,
    createdAt: new Date('2030-01-01T08:00:00.000Z'),
    updatedAt: new Date('2030-01-01T08:00:00.000Z'),
    institutionId: 'institution-1',
    institutionName: 'UTA',
    institutionIsActive: true,
    membershipStatus: MembershipStatus.Active,
    membershipUserId: 'user-1',
    membershipUserFullName: 'Usuario Uno',
    ...overrides,
  };
}

function buildAppeal(overrides: Partial<OperationalSanctionAppealRecord> = {}): OperationalSanctionAppealRecord {
  return {
    id: 'appeal-1',
    sanctionId: 'sanction-1',
    sanctionType: OperationalSanctionType.LimitedPassenger,
    sanctionScope: OperationalSanctionScope.Passenger,
    sanctionStatus: OperationalSanctionStatus.Active,
    sanctionTrigger: OperationalSanctionTrigger.PassengerNoShow,
    sanctionReason: 'Restriccion temporal por reincidencia.',
    sanctionStartedAt: new Date('2030-01-01T08:00:00.000Z'),
    sanctionEndsAt: new Date('2030-01-08T08:00:00.000Z'),
    institutionId: 'institution-1',
    institutionName: 'UTA',
    institutionIsActive: true,
    membershipId: 'membership-1',
    membershipStatus: MembershipStatus.Active,
    affectedUserId: 'user-1',
    affectedFullName: 'Usuario Uno',
    requestedByUserId: 'user-1',
    requestedByFullName: 'Usuario Uno',
    status: OperationalSanctionAppealStatus.Pending,
    reason: 'Solicito revision por un caso excepcional debidamente documentado.',
    reviewNote: null,
    reviewedAt: null,
    reviewedByUserId: null,
    reviewedByFullName: null,
    createdAt: new Date('2030-01-01T09:00:00.000Z'),
    updatedAt: new Date('2030-01-01T09:00:00.000Z'),
    ...overrides,
  };
}

describe('SubmitSanctionAppealUseCase', () => {
  it('creates an appeal for an owned active sanction and records audit', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitSanctionAppealUseCase(repository, auditService);

    repository.findSanctionDetailById.mockResolvedValue(buildSanction());
    repository.findAppealBySanctionId.mockResolvedValue(null);
    repository.createOperationalSanctionAppeal.mockResolvedValue(buildAppeal());

    const response = await useCase.execute(buildCurrentUser(), {
      sanctionId: 'sanction-1',
      reason: 'Solicito revision por un caso excepcional debidamente documentado.',
    });

    expect(response.message).toBe('Apelacion enviada correctamente para revision administrativa.');
    expect(repository.createOperationalSanctionAppeal).toHaveBeenCalledWith({
      sanctionId: 'sanction-1',
      requestedByUserId: 'user-1',
      reason: 'Solicito revision por un caso excepcional debidamente documentado.',
    });
    expect(auditService.record).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      institutionId: 'institution-1',
      action: AuditAction.SanctionAppealSubmitted,
      entityType: AuditEntityType.SanctionAppeal,
      entityId: 'appeal-1',
      metadata: {
        sanctionId: 'sanction-1',
        sanctionType: OperationalSanctionType.LimitedPassenger,
        sanctionScope: OperationalSanctionScope.Passenger,
      },
    });
  });

  it('rejects sanctions from another user or missing sanctions', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitSanctionAppealUseCase(repository, auditService);

    repository.findSanctionDetailById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildSanction({ membershipUserId: 'another-user' }));

    await expect(
      useCase.execute(buildCurrentUser(), {
        sanctionId: 'sanction-1',
        reason: 'Solicito revision por un caso excepcional debidamente documentado.',
      }),
    ).rejects.toThrow(new NotFoundException('La sancion indicada no existe.'));

    await expect(
      useCase.execute(buildCurrentUser(), {
        sanctionId: 'sanction-1',
        reason: 'Solicito revision por un caso excepcional debidamente documentado.',
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'No tienes permisos para apelar una sancion asociada a otra membresia.',
      ),
    );
  });

  it('blocks duplicate appeals and warning sanctions', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new SubmitSanctionAppealUseCase(repository, auditService);

    repository.findSanctionDetailById
      .mockResolvedValueOnce(buildSanction({ type: OperationalSanctionType.Warning }))
      .mockResolvedValueOnce(buildSanction());
    repository.findAppealBySanctionId.mockResolvedValue(buildAppeal());

    await expect(
      useCase.execute(buildCurrentUser(), {
        sanctionId: 'sanction-1',
        reason: 'Solicito revision por un caso excepcional debidamente documentado.',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Las advertencias activas no requieren apelacion administrativa en esta fase.',
      ),
    );

    await expect(
      useCase.execute(buildCurrentUser(), {
        sanctionId: 'sanction-1',
        reason: 'Solicito revision por un caso excepcional debidamente documentado.',
      }),
    ).rejects.toThrow(
      new BadRequestException('Ya existe una apelacion pendiente para esta sancion.'),
    );
  });
});
