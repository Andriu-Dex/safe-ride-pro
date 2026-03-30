import { ForbiddenException } from '@nestjs/common';
import {
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
} from '@saferidepro/shared-types';

import { AuditAction, AuditEntityType } from '../../../src/modules/audit/domain/audit.types';
import { AuditService } from '../../../src/modules/audit/application/services/audit.service';
import type {
  CreateOperationalSanctionInput,
  OperationalSanctionRecord,
  SanctionsRepository,
} from '../../../src/modules/sanctions/application/ports/sanctions.repository';
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

function buildMetrics(
  overrides: Partial<{
    passengerNoShows: number;
    latePassengerTripRequestCancellations: number;
    lateDriverTripCancellations: number;
    resolvedReportsReceived: number;
    resolvedLowSeverityReportsReceived: number;
    resolvedMediumSeverityReportsReceived: number;
    resolvedHighSeverityReportsReceived: number;
  }> = {},
) {
  return {
    passengerNoShows: 0,
    latePassengerTripRequestCancellations: 0,
    lateDriverTripCancellations: 0,
    resolvedReportsReceived: 0,
    resolvedLowSeverityReportsReceived: 0,
    resolvedMediumSeverityReportsReceived: 0,
    resolvedHighSeverityReportsReceived: 0,
    ...overrides,
  };
}

function buildSanctionRecord(
  overrides: Partial<OperationalSanctionRecord> = {},
): OperationalSanctionRecord {
  return {
    id: 'sanction-1',
    membershipId: 'membership-1',
    type: OperationalSanctionType.Warning,
    scope: OperationalSanctionScope.Passenger,
    status: OperationalSanctionStatus.Active,
    trigger: OperationalSanctionTrigger.PassengerNoShow,
    reason: 'Advertencia activa',
    isAutomatic: true,
    startedAt: new Date('2030-01-01T08:00:00.000Z'),
    endsAt: new Date('2030-01-04T08:00:00.000Z'),
    expiredAt: null,
    metadata: null,
    createdAt: new Date('2030-01-01T08:00:00.000Z'),
    updatedAt: new Date('2030-01-01T08:00:00.000Z'),
    ...overrides,
  };
}

describe('OperationalSanctionsService', () => {
  it('creates a passenger warning after two no-shows and records audit', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.findInstitutionIdByMembershipId.mockResolvedValue('institution-1');
    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.countRecentBlockingSanctionsByScope.mockResolvedValue(0);
    repository.getRecentMetrics.mockResolvedValue(
      buildMetrics({
        passengerNoShows: 2,
      }),
    );
    repository.listActiveSanctions.mockResolvedValue([]);
    repository.createOperationalSanction.mockImplementation(
      async (input: CreateOperationalSanctionInput) =>
        buildSanctionRecord({
          membershipId: input.membershipId,
          type: input.type,
          scope: input.scope,
          trigger: input.trigger,
          reason: input.reason,
          startedAt: input.startedAt,
          endsAt: input.endsAt,
          metadata: input.metadata ?? null,
        }),
    );

    const sanctions = await service.synchronizeAutomaticSanctions('membership-1');

    expect(sanctions).toHaveLength(1);
    expect(sanctions[0]).toMatchObject({
      type: OperationalSanctionType.Warning,
      scope: OperationalSanctionScope.Passenger,
      trigger: OperationalSanctionTrigger.PassengerNoShow,
    });
    expect(auditService.record).toHaveBeenCalledWith({
      actorUserId: undefined,
      institutionId: 'institution-1',
      action: AuditAction.SanctionApplied,
      entityType: AuditEntityType.UserMembership,
      entityId: 'membership-1',
      metadata: expect.objectContaining({
        sanctionId: 'sanction-1',
        type: OperationalSanctionType.Warning,
        scope: OperationalSanctionScope.Passenger,
      }),
    });
  });

  it('upgrades an existing passenger warning to a limited passenger sanction when severity increases', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.findInstitutionIdByMembershipId.mockResolvedValue('institution-1');
    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.countRecentBlockingSanctionsByScope.mockResolvedValue(0);
    repository.getRecentMetrics.mockResolvedValue(
      buildMetrics({
        passengerNoShows: 3,
      }),
    );
    repository.listActiveSanctions.mockResolvedValue([
      buildSanctionRecord(),
    ]);
    repository.expireSanction.mockResolvedValue(
      buildSanctionRecord({
        status: OperationalSanctionStatus.Expired,
        expiredAt: new Date('2030-01-02T08:00:00.000Z'),
      }),
    );
    repository.createOperationalSanction.mockImplementation(
      async (input: CreateOperationalSanctionInput) =>
        buildSanctionRecord({
          id: 'sanction-2',
          membershipId: input.membershipId,
          type: input.type,
          scope: input.scope,
          trigger: input.trigger,
          reason: input.reason,
          startedAt: input.startedAt,
          endsAt: input.endsAt,
          metadata: input.metadata ?? null,
        }),
    );

    const sanctions = await service.synchronizeAutomaticSanctions('membership-1');

    expect(repository.expireSanction).toHaveBeenCalledWith(
      'sanction-1',
      expect.any(Date),
    );
    expect(sanctions[0].type).toBe(OperationalSanctionType.LimitedPassenger);
  });

  it('duplicates the duration when a blocking sanction recurs inside the recurrence window', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.findInstitutionIdByMembershipId.mockResolvedValue('institution-1');
    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.countRecentBlockingSanctionsByScope.mockResolvedValue(1);
    repository.getRecentMetrics.mockResolvedValue(
      buildMetrics({
        passengerNoShows: 3,
      }),
    );
    repository.listActiveSanctions.mockResolvedValue([]);
    repository.createOperationalSanction.mockImplementation(
      async (input: CreateOperationalSanctionInput) =>
        buildSanctionRecord({
          id: 'sanction-4',
          membershipId: input.membershipId,
          type: input.type,
          scope: input.scope,
          trigger: input.trigger,
          reason: input.reason,
          startedAt: input.startedAt,
          endsAt: input.endsAt,
          metadata: input.metadata ?? null,
        }),
    );

    const sanctions = await service.synchronizeAutomaticSanctions('membership-1');

    expect(repository.createOperationalSanction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: OperationalSanctionType.LimitedPassenger,
        scope: OperationalSanctionScope.Passenger,
        metadata: expect.objectContaining({
          durationMultiplier: 2,
          recurrenceWindowDays: 90,
          recentBlockingSanctionCount: 1,
        }),
      }),
    );
    expect(sanctions[0].reason).toContain(
      'La duracion se agravo por reincidencia reciente',
    );
    expect(repository.createOperationalSanction).toHaveBeenCalledWith(
      expect.objectContaining({
        endsAt: expect.any(Date),
        startedAt: expect.any(Date),
      }),
    );

    const createInput = repository.createOperationalSanction.mock.calls[0][0];
    const durationMs =
      (createInput.endsAt?.getTime() ?? 0) - createInput.startedAt.getTime();

    expect(durationMs).toBe(14 * 24 * 60 * 60 * 1_000);
  });

  it('does not aggravate a sanction again when the only prior restrictive record is the currently active sanction', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.countRecentBlockingSanctionsByScope.mockResolvedValue(1);
    repository.getRecentMetrics.mockResolvedValue(
      buildMetrics({
        passengerNoShows: 3,
      }),
    );
    repository.listActiveSanctions.mockResolvedValue([
      buildSanctionRecord({
        id: 'sanction-5',
        type: OperationalSanctionType.LimitedPassenger,
        scope: OperationalSanctionScope.Passenger,
        trigger: OperationalSanctionTrigger.PassengerNoShow,
        endsAt: new Date('2030-01-08T08:00:00.000Z'),
      }),
    ]);

    const sanctions = await service.synchronizeAutomaticSanctions('membership-1');

    expect(repository.createOperationalSanction).not.toHaveBeenCalled();
    expect(repository.expireSanction).not.toHaveBeenCalled();
    expect(sanctions[0].endsAt?.toISOString()).toBe('2030-01-08T08:00:00.000Z');
  });

  it('blocks passenger operations when an active limited passenger sanction exists', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.countRecentBlockingSanctionsByScope.mockResolvedValue(0);
    repository.getRecentMetrics.mockResolvedValue(
      buildMetrics({
        passengerNoShows: 3,
      }),
    );
    repository.listActiveSanctions.mockResolvedValue([
      buildSanctionRecord({
        id: 'sanction-2',
        type: OperationalSanctionType.LimitedPassenger,
        scope: OperationalSanctionScope.Passenger,
        trigger: OperationalSanctionTrigger.PassengerNoShow,
        reason: 'Restriccion activa',
        endsAt: new Date('2030-01-08T08:00:00.000Z'),
      }),
    ]);

    await expect(service.assertPassengerOperationsAllowed('membership-1')).rejects.toThrow(
      new ForbiddenException(
        'Tu membresia tiene una restriccion temporal para operar como pasajero hasta 08/01/2030.',
      ),
    );
  });

  it('creates a suspension after two resolved reports in the review window', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.findInstitutionIdByMembershipId.mockResolvedValue('institution-1');
    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.countRecentBlockingSanctionsByScope.mockResolvedValue(0);
    repository.getRecentMetrics.mockResolvedValue(
      buildMetrics({
        resolvedReportsReceived: 2,
        resolvedMediumSeverityReportsReceived: 2,
      }),
    );
    repository.listActiveSanctions.mockResolvedValue([]);
    repository.createOperationalSanction.mockImplementation(
      async (input: CreateOperationalSanctionInput) =>
        buildSanctionRecord({
          id: 'sanction-3',
          membershipId: input.membershipId,
          type: input.type,
          scope: input.scope,
          trigger: input.trigger,
          reason: input.reason,
          startedAt: input.startedAt,
          endsAt: input.endsAt,
          metadata: input.metadata ?? null,
        }),
    );

    const sanctions = await service.synchronizeAutomaticSanctions('membership-1');

    expect(sanctions[0]).toMatchObject({
      type: OperationalSanctionType.Suspended,
      scope: OperationalSanctionScope.All,
      trigger: OperationalSanctionTrigger.ResolvedReports,
    });
  });

  it('uses a stronger suspension when a high-severity resolved report combines with recurrence', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.findInstitutionIdByMembershipId.mockResolvedValue('institution-1');
    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.countRecentBlockingSanctionsByScope.mockResolvedValue(0);
    repository.getRecentMetrics.mockResolvedValue(
      buildMetrics({
        resolvedReportsReceived: 2,
        resolvedMediumSeverityReportsReceived: 1,
        resolvedHighSeverityReportsReceived: 1,
      }),
    );
    repository.listActiveSanctions.mockResolvedValue([]);
    repository.createOperationalSanction.mockImplementation(
      async (input: CreateOperationalSanctionInput) =>
        buildSanctionRecord({
          id: 'sanction-6',
          membershipId: input.membershipId,
          type: input.type,
          scope: input.scope,
          trigger: input.trigger,
          reason: input.reason,
          startedAt: input.startedAt,
          endsAt: input.endsAt,
          metadata: input.metadata ?? null,
        }),
    );

    const sanctions = await service.synchronizeAutomaticSanctions('membership-1');

    expect(sanctions[0]).toMatchObject({
      type: OperationalSanctionType.Suspended,
      scope: OperationalSanctionScope.All,
      trigger: OperationalSanctionTrigger.ResolvedReports,
    });
    expect(repository.createOperationalSanction).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          highSeverityReports: 1,
          mediumSeverityReports: 1,
          lowSeverityReports: 0,
        }),
      }),
    );

    const createInput = repository.createOperationalSanction.mock.calls[0][0];
    const durationMs =
      (createInput.endsAt?.getTime() ?? 0) - createInput.startedAt.getTime();

    expect(durationMs).toBe(14 * 24 * 60 * 60 * 1_000);
  });

  it('returns recent sanction history for trust calculations', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.getRecentSanctionHistory.mockResolvedValue({
      recentSanctionCount: 3,
      recentBlockingSanctionCount: 1,
      recurrenceWindowDays: 90,
    });

    const history = await service.getRecentSanctionHistory('membership-1');

    expect(history.recentSanctionCount).toBe(3);
    expect(history.recentBlockingSanctionCount).toBe(1);
    expect(history.recurrenceWindowDays).toBe(90);
  });
});
