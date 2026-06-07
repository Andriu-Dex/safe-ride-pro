import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  MembershipStatus,
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
    listManuallyLiftedAutomaticSanctions: jest.fn(),
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

  it('does not recreate a manually lifted automatic sanction for the same events', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.countRecentBlockingSanctionsByScope.mockResolvedValue(1);
    repository.getRecentMetrics.mockResolvedValue(
      buildMetrics({
        lateDriverTripCancellations: 3,
      }),
    );
    repository.listActiveSanctions.mockResolvedValue([]);
    (
      repository.listManuallyLiftedAutomaticSanctions as jest.MockedFunction<
        NonNullable<SanctionsRepository['listManuallyLiftedAutomaticSanctions']>
      >
    ).mockResolvedValue([
      buildSanctionRecord({
        id: 'sanction-lifted',
        type: OperationalSanctionType.LimitedDriver,
        scope: OperationalSanctionScope.Driver,
        trigger: OperationalSanctionTrigger.LateDriverCancellation,
        status: OperationalSanctionStatus.Expired,
        expiredAt: new Date('2026-06-01T12:00:00.000Z'),
        endsAt: new Date('2030-01-08T08:00:00.000Z'),
        metadata: {
          threshold: 3,
          eventCount: 3,
          manualLift: {
            liftedAt: '2026-06-01T12:00:00.000Z',
            liftedByUserId: 'admin-1',
            originalEndsAt: '2030-01-08T08:00:00.000Z',
            suppressedEventCount: 3,
          },
        },
      }),
    ]);

    const sanctions = await service.synchronizeAutomaticSanctions('membership-1');

    expect(sanctions).toEqual([]);
    expect(repository.createOperationalSanction).not.toHaveBeenCalled();
  });

  it('creates a new sanction after manual lift when a new event increases the metric', async () => {
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
        lateDriverTripCancellations: 4,
      }),
    );
    repository.listActiveSanctions.mockResolvedValue([]);
    (
      repository.listManuallyLiftedAutomaticSanctions as jest.MockedFunction<
        NonNullable<SanctionsRepository['listManuallyLiftedAutomaticSanctions']>
      >
    ).mockResolvedValue([
      buildSanctionRecord({
        id: 'sanction-lifted',
        type: OperationalSanctionType.LimitedDriver,
        scope: OperationalSanctionScope.Driver,
        trigger: OperationalSanctionTrigger.LateDriverCancellation,
        status: OperationalSanctionStatus.Expired,
        expiredAt: new Date('2026-06-01T12:00:00.000Z'),
        metadata: {
          threshold: 3,
          eventCount: 3,
          manualLift: {
            liftedAt: '2026-06-01T12:00:00.000Z',
            liftedByUserId: 'admin-1',
            originalEndsAt: '2030-01-08T08:00:00.000Z',
            suppressedEventCount: 3,
          },
        },
      }),
    ]);
    repository.createOperationalSanction.mockImplementation(
      async (input: CreateOperationalSanctionInput) =>
        buildSanctionRecord({
          id: 'sanction-new',
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
        type: OperationalSanctionType.LimitedDriver,
        scope: OperationalSanctionScope.Driver,
        metadata: expect.objectContaining({
          eventCount: 4,
        }),
      }),
    );
    expect(sanctions).toHaveLength(1);
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

  it('stores manual lift metadata when an admin lifts an active sanction', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.findSanctionDetailById.mockResolvedValue({
      ...buildSanctionRecord({
        type: OperationalSanctionType.LimitedDriver,
        scope: OperationalSanctionScope.Driver,
        trigger: OperationalSanctionTrigger.LateDriverCancellation,
        metadata: {
          threshold: 3,
          eventCount: 3,
        },
      }),
      institutionId: 'institution-1',
      institutionName: 'UTA',
      institutionIsActive: true,
      membershipStatus: MembershipStatus.Active,
      membershipUserId: 'user-1',
      membershipUserFullName: 'Usuario Uno',
    });
    repository.expireSanction.mockImplementation(
      async (sanctionId, asOf, metadata) =>
        buildSanctionRecord({
          id: sanctionId,
          status: OperationalSanctionStatus.Expired,
          expiredAt: asOf,
          metadata: metadata ?? null,
        }),
    );

    await service.liftSanctionManually({
      sanctionId: 'sanction-1',
      actorUserId: 'admin-1',
      reviewNote: 'Correccion administrativa.',
    });

    expect(repository.expireSanction).toHaveBeenCalledWith(
      'sanction-1',
      expect.any(Date),
      expect.objectContaining({
        threshold: 3,
        eventCount: 3,
        manualLift: expect.objectContaining({
          liftedByUserId: 'admin-1',
          reviewNote: 'Correccion administrativa.',
          suppressedEventCount: 3,
          originalEndsAt: '2030-01-04T08:00:00.000Z',
        }),
      }),
    );
  });

  it('records audit when synchronizing and expiring elapsed sanctions', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.expireElapsedSanctions.mockResolvedValue([
      buildSanctionRecord({ id: 'sanction-expired', status: OperationalSanctionStatus.Expired }),
    ]);
    repository.findInstitutionIdByMembershipId.mockResolvedValue('institution-1');
    repository.getRecentMetrics.mockResolvedValue(buildMetrics());
    repository.listActiveSanctions.mockResolvedValue([]);

    await service.synchronizeAutomaticSanctions('membership-1');

    expect(auditService.record).toHaveBeenCalledWith({
      actorUserId: undefined,
      institutionId: 'institution-1',
      action: AuditAction.SanctionExpired,
      entityType: AuditEntityType.UserMembership,
      entityId: 'membership-1',
      metadata: expect.objectContaining({
        sanctionId: 'sanction-expired',
      }),
    });
  });

  it('allows passenger operations when no passenger blocking sanction exists', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.getRecentMetrics.mockResolvedValue(buildMetrics());
    repository.listActiveSanctions.mockResolvedValue([]);

    await expect(service.assertPassengerOperationsAllowed('membership-1')).resolves.not.toThrow();
  });

  it('blocks driver operations when an active limited driver sanction exists', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.listActiveSanctions.mockResolvedValue([
      buildSanctionRecord({
        id: 'sanction-driver',
        type: OperationalSanctionType.LimitedDriver,
        scope: OperationalSanctionScope.Driver,
        trigger: OperationalSanctionTrigger.LateDriverCancellation,
        endsAt: new Date('2030-01-08T08:00:00.000Z'),
      }),
    ]);
    repository.getRecentMetrics.mockResolvedValue(buildMetrics());

    await expect(service.assertDriverOperationsAllowed('membership-1')).rejects.toThrow(
      new ForbiddenException(
        'Tu membresia tiene una restriccion temporal para operar como conductor hasta 08/01/2030.',
      ),
    );
  });

  it('blocks operations with correct message for suspended and warnings', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.listActiveSanctions.mockResolvedValue([
      buildSanctionRecord({
        id: 'sanction-suspended',
        type: OperationalSanctionType.Suspended,
        scope: OperationalSanctionScope.All,
        endsAt: new Date('2030-01-08T08:00:00.000Z'),
      }),
    ]);
    repository.getRecentMetrics.mockResolvedValue(buildMetrics());

    await expect(service.assertPassengerOperationsAllowed('membership-1')).rejects.toThrow(
      'Tu membresia se encuentra suspendida temporalmente para operar en movilidad hasta 08/01/2030.',
    );
  });

  it('throws NotFoundException if manual lift is attempted on non-existent sanction', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.findSanctionDetailById.mockResolvedValue(null);

    await expect(
      service.liftSanctionManually({
        sanctionId: 'non-existent',
        actorUserId: 'admin-1',
        reviewNote: 'Correccion.',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException if manual lift is attempted on inactive sanction', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.findSanctionDetailById.mockResolvedValue({
      ...buildSanctionRecord({ status: OperationalSanctionStatus.Expired }),
      institutionId: 'institution-1',
      institutionName: 'UTA',
      institutionIsActive: true,
      membershipStatus: MembershipStatus.Active,
      membershipUserId: 'user-1',
      membershipUserFullName: 'Usuario Uno',
    });

    await expect(
      service.liftSanctionManually({
        sanctionId: 'sanction-1',
        actorUserId: 'admin-1',
        reviewNote: 'Correccion.',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('handles edge cases in isSuppressedByManualLift, getManualLiftMetadata, getSanctionDurationDays, getDecisionSeverity', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.findInstitutionIdByMembershipId.mockResolvedValue('institution-1');
    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.expireSanction.mockImplementation(async (sanctionId) =>
      buildSanctionRecord({ id: sanctionId, status: OperationalSanctionStatus.Expired }),
    );
    repository.getRecentMetrics.mockResolvedValue(
      buildMetrics({
        passengerNoShows: 3,
      }),
    );
    repository.listActiveSanctions.mockResolvedValue([]);

    (
      repository.listManuallyLiftedAutomaticSanctions as jest.MockedFunction<
        NonNullable<SanctionsRepository['listManuallyLiftedAutomaticSanctions']>
      >
    ).mockResolvedValue([
      buildSanctionRecord({
        id: 'lifted-unmatched',
        type: OperationalSanctionType.LimitedDriver,
        metadata: {
          manualLift: {
            originalEndsAt: '2030-01-08T08:00:00.000Z',
            suppressedEventCount: 3,
          },
        },
      }),
      buildSanctionRecord({
        id: 'lifted-no-manualLift-prop',
        type: OperationalSanctionType.LimitedPassenger,
        metadata: {},
      }),
      buildSanctionRecord({
        id: 'lifted-past-endsat',
        type: OperationalSanctionType.LimitedPassenger,
        metadata: {
          manualLift: {
            originalEndsAt: '2020-01-01T08:00:00.000Z',
            suppressedEventCount: 3,
          },
        },
      }),
      buildSanctionRecord({
        id: 'lifted-bad-manualLift-format',
        type: OperationalSanctionType.LimitedPassenger,
        metadata: {
          manualLift: 'not-an-object',
        },
      }),
    ]);

    repository.createOperationalSanction.mockImplementation(
      async (input: CreateOperationalSanctionInput) =>
        buildSanctionRecord({
          id: 'sanction-new',
          membershipId: input.membershipId,
          type: input.type,
          scope: input.scope,
          trigger: input.trigger,
          reason: input.reason,
          startedAt: input.startedAt,
          endsAt: null,
          metadata: input.metadata ?? null,
        }),
    );

    const sanctions = await service.synchronizeAutomaticSanctions('membership-1');
    expect(sanctions).toHaveLength(1);

    const severityDefault = (service as any).getDecisionSeverity('UNKNOWN');
    expect(severityDefault).toBe(0);

    const severitySuspended = (service as any).getDecisionSeverity(OperationalSanctionType.Suspended);
    expect(severitySuspended).toBe(3);

    const warningMsg = (service as any).buildBlockingMessage({
      type: OperationalSanctionType.Warning,
      scope: OperationalSanctionScope.Passenger,
      endsAt: null,
    });
    expect(warningMsg).toBe('Tu membresia tiene una advertencia activa.');

    const suspendedMsgNull = (service as any).buildBlockingMessage({
      type: OperationalSanctionType.Suspended,
      scope: OperationalSanctionScope.All,
      endsAt: null,
    });
    expect(suspendedMsgNull).toBe('Tu membresia se encuentra suspendida temporalmente para operar en movilidad.');

    const limitedDriverMsg = (service as any).buildBlockingMessage({
      type: OperationalSanctionType.LimitedDriver,
      scope: OperationalSanctionScope.Driver,
      endsAt: null,
    });
    expect(limitedDriverMsg).toBe('Tu membresia tiene una restriccion temporal para operar como conductor.');

    await expect(service.assertDriverOperationsAllowed('membership-1')).resolves.not.toThrow();

    repository.getRecentMetrics.mockResolvedValue(buildMetrics());
    repository.listActiveSanctions.mockResolvedValue([
      buildSanctionRecord({ id: 'sanction-older', startedAt: new Date('2030-01-01T08:00:00.000Z') }),
      buildSanctionRecord({ id: 'sanction-newer', startedAt: new Date('2030-01-02T08:00:00.000Z') }),
    ]);
    const sortedSanctions = await service.synchronizeAutomaticSanctions('membership-1');
    expect(sortedSanctions[0].id).toBe('sanction-newer');
    expect(sortedSanctions[1].id).toBe('sanction-older');

    const duration = (service as any).getSanctionDurationDays({
      endsAt: null,
    });
    expect(duration).toBe(Number.MAX_SAFE_INTEGER);
  });
});
