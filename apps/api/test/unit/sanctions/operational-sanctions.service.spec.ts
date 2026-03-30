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
    listActiveSanctions: jest.fn(),
    expireElapsedSanctions: jest.fn(),
    expireSanction: jest.fn(),
    createOperationalSanction: jest.fn(),
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
    repository.getRecentMetrics.mockResolvedValue({
      passengerNoShows: 2,
      latePassengerTripRequestCancellations: 0,
      lateDriverTripCancellations: 0,
      resolvedReportsReceived: 0,
    });
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
    repository.getRecentMetrics.mockResolvedValue({
      passengerNoShows: 3,
      latePassengerTripRequestCancellations: 0,
      lateDriverTripCancellations: 0,
      resolvedReportsReceived: 0,
    });
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

  it('blocks passenger operations when an active limited passenger sanction exists', async () => {
    const repository = createSanctionsRepositoryMock();
    const auditService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    const service = new OperationalSanctionsService(repository, auditService);

    repository.expireElapsedSanctions.mockResolvedValue([]);
    repository.getRecentMetrics.mockResolvedValue({
      passengerNoShows: 3,
      latePassengerTripRequestCancellations: 0,
      lateDriverTripCancellations: 0,
      resolvedReportsReceived: 0,
    });
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
    repository.getRecentMetrics.mockResolvedValue({
      passengerNoShows: 0,
      latePassengerTripRequestCancellations: 0,
      lateDriverTripCancellations: 0,
      resolvedReportsReceived: 2,
    });
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
});
