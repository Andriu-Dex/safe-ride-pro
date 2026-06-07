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
  OperationalSanctionAppealRecord,
  SanctionsRepository,
} from '../../../src/modules/sanctions/application/ports/sanctions.repository';
import { ReviewSanctionAppealUseCase } from '../../../src/modules/sanctions/application/use-cases/review-sanction-appeal.use-case';
import { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';

jest.mock('../../../src/modules/sanctions/application/utils/sanctions-admin-access', () => {
  const actual = jest.requireActual('../../../src/modules/sanctions/application/utils/sanctions-admin-access');
  return {
    ...actual,
    resolveReviewableInstitutionScope: jest.fn((currentUser, instId) => {
      if (instId === 'trigger-use-case-forbidden') {
        return ['some-other-institution'];
      }
      return actual.resolveReviewableInstitutionScope(currentUser, instId);
    }),
  };
});

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

describe('ReviewSanctionAppealUseCase', () => {
  it('approves an appeal, lifts the sanction and records audit', async () => {
    const repository = createSanctionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewSanctionAppealUseCase(
      repository,
      sanctionsService,
      auditService,
    );

    repository.findAppealById.mockResolvedValue(buildAppeal());
    repository.reviewOperationalSanctionAppeal.mockResolvedValue(
      buildAppeal({
        status: OperationalSanctionAppealStatus.Approved,
        reviewNote: 'La evidencia presentada justifica levantar la sancion aplicada.',
      }),
    );

    const response = await useCase.execute(buildAdminUser(), {
      appealId: 'appeal-1',
      status: OperationalSanctionAppealStatus.Approved,
      reviewNote: 'La evidencia presentada justifica levantar la sancion aplicada.',
    });

    expect(response.message).toBe('Apelacion revisada correctamente.');
    expect(sanctionsService.liftSanctionManually).toHaveBeenCalledWith({
      sanctionId: 'sanction-1',
      actorUserId: 'admin-1',
      reviewNote: 'La evidencia presentada justifica levantar la sancion aplicada.',
      relatedAppealId: 'appeal-1',
    });
    expect(auditService.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      institutionId: 'institution-1',
      action: AuditAction.SanctionAppealApproved,
      entityType: AuditEntityType.SanctionAppeal,
      entityId: 'appeal-1',
      metadata: {
        sanctionId: 'sanction-1',
        sanctionType: OperationalSanctionType.LimitedPassenger,
        sanctionScope: OperationalSanctionScope.Passenger,
        reviewNote: 'La evidencia presentada justifica levantar la sancion aplicada.',
      },
    });
  });

  it('rejects an appeal and records audit', async () => {
    const repository = createSanctionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewSanctionAppealUseCase(
      repository,
      sanctionsService,
      auditService,
    );

    repository.findAppealById.mockResolvedValue(buildAppeal());
    repository.reviewOperationalSanctionAppeal.mockResolvedValue(
      buildAppeal({
        status: OperationalSanctionAppealStatus.Rejected,
        reviewNote: 'Rechazo justificable.',
      }),
    );

    const response = await useCase.execute(buildAdminUser(), {
      appealId: 'appeal-1',
      status: OperationalSanctionAppealStatus.Rejected,
      reviewNote: 'Rechazo justificable.',
    });

    expect(response.message).toBe('Apelacion revisada correctamente.');
    expect(sanctionsService.liftSanctionManually).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.SanctionAppealRejected,
      }),
    );
  });

  it('rejects invalid review attempts', async () => {
    const repository = createSanctionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewSanctionAppealUseCase(
      repository,
      sanctionsService,
      auditService,
    );

    repository.findAppealById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(buildAppeal({ requestedByUserId: 'admin-1' }))
      .mockResolvedValueOnce(
        buildAppeal({ status: OperationalSanctionAppealStatus.Rejected }),
      );

    await expect(
      useCase.execute(buildAdminUser(), {
        appealId: 'appeal-1',
        status: OperationalSanctionAppealStatus.Approved,
        reviewNote: 'La evidencia presentada justifica levantar la sancion aplicada.',
      }),
    ).rejects.toThrow(new NotFoundException('La apelacion indicada no existe.'));

    await expect(
      useCase.execute(buildAdminUser(), {
        appealId: 'appeal-1',
        status: OperationalSanctionAppealStatus.Approved,
        reviewNote: 'La evidencia presentada justifica levantar la sancion aplicada.',
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'No puedes revisar una apelacion asociada directamente a tu propia sancion.',
      ),
    );

    await expect(
      useCase.execute(buildAdminUser(), {
        appealId: 'appeal-1',
        status: OperationalSanctionAppealStatus.Approved,
        reviewNote: 'La evidencia presentada justifica levantar la sancion aplicada.',
      }),
    ).rejects.toThrow(
      new BadRequestException('La apelacion ya fue revisada anteriormente.'),
    );
  });

  it('throws ForbiddenException if administrator does not belong to the institution of the appeal', async () => {
    const repository = createSanctionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewSanctionAppealUseCase(
      repository,
      sanctionsService,
      auditService,
    );

    repository.findAppealById.mockResolvedValue(buildAppeal({ institutionId: 'trigger-use-case-forbidden' }));

    await expect(
      useCase.execute(buildAdminUser(), {
        appealId: 'appeal-1',
        status: OperationalSanctionAppealStatus.Approved,
        reviewNote: 'La evidencia presentada justifica levantar la sancion.',
      }),
    ).rejects.toThrow(
      new ForbiddenException('No tienes permisos para revisar apelaciones de esa institucion.'),
    );
  });

  it('throws BadRequestException if attempting to set the appeal status back to PENDING', async () => {
    const repository = createSanctionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewSanctionAppealUseCase(
      repository,
      sanctionsService,
      auditService,
    );

    repository.findAppealById.mockResolvedValue(buildAppeal());

    await expect(
      useCase.execute(buildAdminUser(), {
        appealId: 'appeal-1',
        status: OperationalSanctionAppealStatus.Pending,
        reviewNote: 'La evidencia presentada justifica levantar la sancion.',
      }),
    ).rejects.toThrow(
      new BadRequestException('No se puede volver a dejar la apelacion en estado pendiente.'),
    );
  });

  it('throws BadRequestException if the review note is missing or too short', async () => {
    const repository = createSanctionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const useCase = new ReviewSanctionAppealUseCase(
      repository,
      sanctionsService,
      auditService,
    );

    repository.findAppealById.mockResolvedValue(buildAppeal());

    await expect(
      useCase.execute(buildAdminUser(), {
        appealId: 'appeal-1',
        status: OperationalSanctionAppealStatus.Approved,
        reviewNote: 'short',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
