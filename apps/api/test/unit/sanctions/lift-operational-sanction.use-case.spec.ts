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

import type { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import type {
  OperationalSanctionAppealRecord,
  OperationalSanctionDetailRecord,
  SanctionsRepository,
} from '../../../src/modules/sanctions/application/ports/sanctions.repository';
import { LiftOperationalSanctionUseCase } from '../../../src/modules/sanctions/application/use-cases/lift-operational-sanction.use-case';
import { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';

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

function createOperationalSanctionsServiceMock(): jest.Mocked<OperationalSanctionsService> {
  return {
    synchronizeAutomaticSanctions: jest.fn(),
    getRecentSanctionHistory: jest.fn(),
    assertPassengerOperationsAllowed: jest.fn(),
    assertDriverOperationsAllowed: jest.fn(),
    liftSanctionManually: jest.fn(),
  } as unknown as jest.Mocked<OperationalSanctionsService>;
}

function buildAdminUser(): CurrentUserContext {
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
        institutionIsActive: true,
        role: InstitutionMembershipRole.InstitutionAdmin,
        membershipStatus: MembershipStatus.Active,
        studentCode: 'ADMIN-001',
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

describe('LiftOperationalSanctionUseCase', () => {
  it('lifts an active sanction manually when there is no pending appeal', async () => {
    const repository = createSanctionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new LiftOperationalSanctionUseCase(repository, sanctionsService);

    repository.findSanctionDetailById.mockResolvedValue(buildSanction());
    repository.findAppealBySanctionId.mockResolvedValue(
      buildAppeal({ status: OperationalSanctionAppealStatus.Rejected }),
    );
    sanctionsService.liftSanctionManually.mockResolvedValue({
      id: 'sanction-1',
      type: OperationalSanctionType.LimitedPassenger,
      scope: OperationalSanctionScope.Passenger,
      status: OperationalSanctionStatus.Expired,
      trigger: OperationalSanctionTrigger.PassengerNoShow,
      reason: 'Restriccion temporal por reincidencia.',
      startedAt: new Date('2030-01-01T08:00:00.000Z'),
      endsAt: new Date('2030-01-08T08:00:00.000Z'),
    });

    const response = await useCase.execute(buildAdminUser(), {
      sanctionId: 'sanction-1',
      reviewNote: 'La restriccion se levanta por correccion documentada del caso.',
    });

    expect(response.message).toBe('Sancion levantada manualmente correctamente.');
    expect(sanctionsService.liftSanctionManually).toHaveBeenCalledWith({
      sanctionId: 'sanction-1',
      actorUserId: 'admin-1',
      reviewNote: 'La restriccion se levanta por correccion documentada del caso.',
    });
  });

  it('rejects missing sanctions, self-lifts and pending appeals', async () => {
    const repository = createSanctionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new LiftOperationalSanctionUseCase(repository, sanctionsService);

    repository.findSanctionDetailById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildSanction({ membershipUserId: 'admin-1' }))
      .mockResolvedValueOnce(buildSanction());
    repository.findAppealBySanctionId.mockResolvedValue(buildAppeal());

    await expect(
      useCase.execute(buildAdminUser(), {
        sanctionId: 'sanction-1',
        reviewNote: 'La restriccion se levanta por correccion documentada del caso.',
      }),
    ).rejects.toThrow(new NotFoundException('La sancion indicada no existe.'));

    await expect(
      useCase.execute(buildAdminUser(), {
        sanctionId: 'sanction-1',
        reviewNote: 'La restriccion se levanta por correccion documentada del caso.',
      }),
    ).rejects.toThrow(
      new ForbiddenException('No puedes levantar manualmente tu propia sancion.'),
    );

    await expect(
      useCase.execute(buildAdminUser(), {
        sanctionId: 'sanction-1',
        reviewNote: 'La restriccion se levanta por correccion documentada del caso.',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'La sancion tiene una apelacion pendiente. Revisa la apelacion antes de levantarla manualmente.',
      ),
    );
  });
});
