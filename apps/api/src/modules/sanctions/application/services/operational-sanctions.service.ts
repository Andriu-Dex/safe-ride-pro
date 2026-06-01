import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  deriveOperationalSanctionDecisions,
  doesSanctionBlockDriverOperations,
  doesSanctionBlockPassengerOperations,
  getRecurrenceDurationMultiplier,
  getOperationalSanctionScopeLabel,
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
  SANCTION_RECURRENCE_WINDOW_DAYS,
  type OperationalSanctionDecision,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import {
  OperationalSanctionRecord,
  SANCTIONS_REPOSITORY,
  SanctionsRepository,
} from '../ports/sanctions.repository';

export type OperationalSanctionSummary = {
  id: string;
  type: OperationalSanctionType;
  scope: OperationalSanctionScope;
  status: OperationalSanctionStatus;
  trigger: OperationalSanctionTrigger;
  reason: string;
  startedAt: Date;
  endsAt: Date | null;
};

export type LiftOperationalSanctionCommand = {
  sanctionId: string;
  actorUserId: string;
  reviewNote: string;
  relatedAppealId?: string;
};

export type RecentOperationalSanctionHistorySummary = {
  recentSanctionCount: number;
  recentBlockingSanctionCount: number;
  recurrenceWindowDays: number;
  lastComputedAt: Date;
};

@Injectable()
export class OperationalSanctionsService {
  constructor(
    @Inject(SANCTIONS_REPOSITORY)
    private readonly sanctionsRepository: SanctionsRepository,
    private readonly auditService: AuditService,
  ) {}

  async synchronizeAutomaticSanctions(
    membershipId: string,
  ): Promise<OperationalSanctionSummary[]> {
    const asOf = new Date();

    const expiredSanctions = await this.sanctionsRepository.expireElapsedSanctions(
      membershipId,
      asOf,
    );

    await Promise.all(
      expiredSanctions.map((sanction) => this.recordExpirationAudit(sanction)),
    );

    const [metrics, activeSanctions, manuallyLiftedAutomaticSanctions] = await Promise.all([
      this.sanctionsRepository.getRecentMetrics(membershipId, asOf),
      this.sanctionsRepository.listActiveSanctions(membershipId, asOf),
      this.sanctionsRepository.listManuallyLiftedAutomaticSanctions?.(
        membershipId,
        asOf,
      ) ?? Promise.resolve([]),
    ]);

    const decisions = deriveOperationalSanctionDecisions(metrics);
    let activeAutomaticSanctions = [...activeSanctions];
    const recurrenceCountsByScope = new Map<OperationalSanctionScope, number>();

    for (const baseDecision of decisions) {
      const currentSanction = activeAutomaticSanctions.find(
        (sanction) => sanction.scope === baseDecision.scope && sanction.isAutomatic,
      );
      const decision = await this.applyRecurrencePolicy(
        membershipId,
        baseDecision,
        currentSanction,
        asOf,
        recurrenceCountsByScope,
      );

      if (
        !currentSanction &&
        this.isSuppressedByManualLift(decision, manuallyLiftedAutomaticSanctions, asOf)
      ) {
        continue;
      }

      if (!currentSanction) {
        const createdSanction = await this.createAutomaticSanction(
          membershipId,
          decision,
          asOf,
        );
        activeAutomaticSanctions.push(createdSanction);
        continue;
      }

      if (!this.shouldReplaceSanction(currentSanction, decision)) {
        continue;
      }

      const expiredSanction = await this.sanctionsRepository.expireSanction(
        currentSanction.id,
        asOf,
      );
      await this.recordExpirationAudit(expiredSanction);

      const createdSanction = await this.createAutomaticSanction(
        membershipId,
        decision,
        asOf,
      );

      activeAutomaticSanctions = activeAutomaticSanctions
        .filter((sanction) => sanction.id !== currentSanction.id)
        .concat(createdSanction);
    }

    return activeAutomaticSanctions
      .filter((sanction) => sanction.status === OperationalSanctionStatus.Active)
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
      .map((sanction) => this.mapSummary(sanction));
  }

  async getRecentSanctionHistory(
    membershipId: string,
  ): Promise<RecentOperationalSanctionHistorySummary> {
    const asOf = new Date();
    const history = await this.sanctionsRepository.getRecentSanctionHistory(
      membershipId,
      asOf,
    );

    return {
      ...history,
      lastComputedAt: asOf,
    };
  }

  async assertPassengerOperationsAllowed(membershipId: string): Promise<void> {
    const activeSanctions = await this.synchronizeAutomaticSanctions(membershipId);
    const blockingSanction = activeSanctions.find((sanction) =>
      doesSanctionBlockPassengerOperations(sanction.type, sanction.scope),
    );

    if (!blockingSanction) {
      return;
    }

    throw new ForbiddenException(this.buildBlockingMessage(blockingSanction));
  }

  async assertDriverOperationsAllowed(membershipId: string): Promise<void> {
    const activeSanctions = await this.synchronizeAutomaticSanctions(membershipId);
    const blockingSanction = activeSanctions.find((sanction) =>
      doesSanctionBlockDriverOperations(sanction.type, sanction.scope),
    );

    if (!blockingSanction) {
      return;
    }

    throw new ForbiddenException(this.buildBlockingMessage(blockingSanction));
  }

  async liftSanctionManually(
    command: LiftOperationalSanctionCommand,
  ): Promise<OperationalSanctionSummary> {
    const sanction = await this.sanctionsRepository.findSanctionDetailById(command.sanctionId);

    if (!sanction) {
      throw new NotFoundException('La sancion indicada no existe.');
    }

    if (!this.isSanctionCurrentlyActive(sanction, new Date())) {
      throw new BadRequestException(
        'La sancion indicada ya no se encuentra activa y no puede levantarse manualmente.',
      );
    }

    const liftedAt = new Date();
    const expiredSanction = await this.sanctionsRepository.expireSanction(
      sanction.id,
      liftedAt,
      {
        ...(sanction.metadata ?? {}),
        manualLift: {
          liftedAt: liftedAt.toISOString(),
          liftedByUserId: command.actorUserId,
          reviewNote: command.reviewNote,
          relatedAppealId: command.relatedAppealId ?? null,
          originalEndsAt: sanction.endsAt?.toISOString() ?? null,
          suppressedEventCount: this.getMetadataNumber(
            sanction.metadata,
            'eventCount',
          ),
        },
      },
    );

    await this.auditService.record({
      actorUserId: command.actorUserId,
      institutionId: sanction.institutionId,
      action: AuditAction.SanctionLiftedManually,
      entityType: AuditEntityType.OperationalSanction,
      entityId: sanction.id,
      metadata: {
        membershipId: sanction.membershipId,
        type: sanction.type,
        scope: sanction.scope,
        trigger: sanction.trigger,
        reviewNote: command.reviewNote,
        relatedAppealId: command.relatedAppealId ?? null,
        previousEndsAt: sanction.endsAt?.toISOString() ?? null,
      },
    });

    return this.mapSummary(expiredSanction);
  }

  private async createAutomaticSanction(
    membershipId: string,
    decision: OperationalSanctionDecision,
    startedAt: Date,
  ): Promise<OperationalSanctionRecord> {
    const endsAt = new Date(startedAt);
    endsAt.setDate(endsAt.getDate() + decision.durationDays);

    const sanction = await this.sanctionsRepository.createOperationalSanction({
      membershipId,
      type: decision.type,
      scope: decision.scope,
      trigger: decision.trigger,
      reason: decision.reason,
      isAutomatic: true,
      startedAt,
      endsAt,
      metadata: {
        ...decision.metadata,
        appliedAt: startedAt.toISOString(),
      },
    });

    const institutionId = await this.sanctionsRepository.findInstitutionIdByMembershipId(
      membershipId,
    );

    await this.auditService.record({
      actorUserId: undefined,
      institutionId: institutionId ?? undefined,
      action: AuditAction.SanctionApplied,
      entityType: AuditEntityType.UserMembership,
      entityId: membershipId,
      metadata: {
        sanctionId: sanction.id,
        type: sanction.type,
        scope: sanction.scope,
        trigger: sanction.trigger,
        isAutomatic: sanction.isAutomatic,
        startedAt: sanction.startedAt.toISOString(),
        endsAt: sanction.endsAt?.toISOString() ?? null,
      },
    });

    return sanction;
  }

  private async applyRecurrencePolicy(
    membershipId: string,
    decision: OperationalSanctionDecision,
    currentSanction: OperationalSanctionRecord | undefined,
    asOf: Date,
    recurrenceCountsByScope: Map<OperationalSanctionScope, number>,
  ): Promise<OperationalSanctionDecision> {
    if (decision.type === OperationalSanctionType.Warning) {
      return decision;
    }

    const existingCount = recurrenceCountsByScope.get(decision.scope);
    const rawRecentBlockingSanctionCount =
      existingCount ??
      (await this.sanctionsRepository.countRecentBlockingSanctionsByScope(
        membershipId,
        decision.scope,
        asOf,
      ));

    recurrenceCountsByScope.set(decision.scope, rawRecentBlockingSanctionCount);
    const recentBlockingSanctionCount = Math.max(
      0,
      rawRecentBlockingSanctionCount -
        (currentSanction && currentSanction.type !== OperationalSanctionType.Warning ? 1 : 0),
    );

    const durationMultiplier = getRecurrenceDurationMultiplier(
      recentBlockingSanctionCount,
    );

    if (durationMultiplier <= 1) {
      return decision;
    }

    return {
      ...decision,
      durationDays: decision.durationDays * durationMultiplier,
      reason: `${decision.reason} La duracion se agravo por reincidencia reciente dentro de ${SANCTION_RECURRENCE_WINDOW_DAYS} dias.`,
      metadata: {
        ...decision.metadata,
        recurrenceWindowDays: SANCTION_RECURRENCE_WINDOW_DAYS,
        recentBlockingSanctionCount,
        durationMultiplier,
      },
    };
  }

  private async recordExpirationAudit(
    sanction: OperationalSanctionRecord,
  ): Promise<void> {
    const institutionId = await this.sanctionsRepository.findInstitutionIdByMembershipId(
      sanction.membershipId,
    );

    await this.auditService.record({
      actorUserId: undefined,
      institutionId: institutionId ?? undefined,
      action: AuditAction.SanctionExpired,
      entityType: AuditEntityType.UserMembership,
      entityId: sanction.membershipId,
      metadata: {
        sanctionId: sanction.id,
        type: sanction.type,
        scope: sanction.scope,
        trigger: sanction.trigger,
        expiredAt: sanction.expiredAt?.toISOString() ?? new Date().toISOString(),
      },
    });
  }

  private shouldReplaceSanction(
    currentSanction: OperationalSanctionRecord,
    decision: OperationalSanctionDecision,
  ): boolean {
    if (
      currentSanction.type !== decision.type ||
      currentSanction.trigger !== decision.trigger
    ) {
      return this.getDecisionSeverity(decision.type) >= this.getDecisionSeverity(currentSanction.type);
    }

    const currentDurationDays = this.getSanctionDurationDays(currentSanction);

    return decision.durationDays > currentDurationDays;
  }

  private isSuppressedByManualLift(
    decision: OperationalSanctionDecision,
    liftedSanctions: OperationalSanctionRecord[],
    asOf: Date,
  ): boolean {
    return liftedSanctions.some((sanction) => {
      if (
        sanction.type !== decision.type ||
        sanction.scope !== decision.scope ||
        sanction.trigger !== decision.trigger
      ) {
        return false;
      }

      const manualLift = this.getManualLiftMetadata(sanction.metadata);

      if (!manualLift) {
        return false;
      }

      if (
        manualLift.originalEndsAt &&
        new Date(manualLift.originalEndsAt).getTime() <= asOf.getTime()
      ) {
        return false;
      }

      const previousEventCount =
        manualLift.suppressedEventCount ??
        this.getMetadataNumber(sanction.metadata, 'eventCount') ??
        0;

      return decision.metadata.eventCount <= previousEventCount;
    });
  }

  private getManualLiftMetadata(
    metadata: Record<string, unknown> | null,
  ): {
    originalEndsAt: string | null;
    suppressedEventCount: number | null;
  } | null {
    const manualLift = metadata?.manualLift;

    if (!manualLift || typeof manualLift !== 'object' || Array.isArray(manualLift)) {
      return null;
    }

    const liftedMetadata = manualLift as Record<string, unknown>;
    const originalEndsAt =
      typeof liftedMetadata.originalEndsAt === 'string'
        ? liftedMetadata.originalEndsAt
        : null;
    const suppressedEventCount =
      typeof liftedMetadata.suppressedEventCount === 'number'
        ? liftedMetadata.suppressedEventCount
        : null;

    return { originalEndsAt, suppressedEventCount };
  }

  private getMetadataNumber(
    metadata: Record<string, unknown> | null,
    key: string,
  ): number | null {
    const value = metadata?.[key];

    return typeof value === 'number' ? value : null;
  }

  private getSanctionDurationDays(sanction: OperationalSanctionRecord): number {
    if (!sanction.endsAt) {
      return Number.MAX_SAFE_INTEGER;
    }

    const millisecondsPerDay = 24 * 60 * 60 * 1_000;
    return Math.max(
      1,
      Math.round((sanction.endsAt.getTime() - sanction.startedAt.getTime()) / millisecondsPerDay),
    );
  }

  private getDecisionSeverity(type: OperationalSanctionType): number {
    switch (type) {
      case OperationalSanctionType.Warning:
        return 1;
      case OperationalSanctionType.LimitedPassenger:
      case OperationalSanctionType.LimitedDriver:
        return 2;
      case OperationalSanctionType.Suspended:
        return 3;
      default:
        return 0;
    }
  }

  private mapSummary(
    sanction: OperationalSanctionRecord,
  ): OperationalSanctionSummary {
    return {
      id: sanction.id,
      type: sanction.type,
      scope: sanction.scope,
      status: sanction.status,
      trigger: sanction.trigger,
      reason: sanction.reason,
      startedAt: sanction.startedAt,
      endsAt: sanction.endsAt,
    };
  }

  private buildBlockingMessage(
    sanction: OperationalSanctionSummary,
  ): string {
    const scopeLabel = getOperationalSanctionScopeLabel(sanction.scope);
    const durationLabel = sanction.endsAt
      ? ` hasta ${this.formatEndDate(sanction.endsAt)}`
      : '';

    if (sanction.type === OperationalSanctionType.Suspended) {
      return `Tu membresia se encuentra suspendida temporalmente para operar en movilidad${durationLabel}.`;
    }

    if (sanction.type === OperationalSanctionType.LimitedPassenger) {
      return `Tu membresia tiene una restriccion temporal para operar como ${scopeLabel}${durationLabel}.`;
    }

    if (sanction.type === OperationalSanctionType.LimitedDriver) {
      return `Tu membresia tiene una restriccion temporal para operar como ${scopeLabel}${durationLabel}.`;
    }

    return 'Tu membresia tiene una advertencia activa.';
  }

  private formatEndDate(date: Date): string {
    const day = `${date.getUTCDate()}`.padStart(2, '0');
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const year = `${date.getUTCFullYear()}`;

    return `${day}/${month}/${year}`;
  }

  private isSanctionCurrentlyActive(
    sanction: {
      status: OperationalSanctionStatus;
      endsAt: Date | null;
    },
    asOf: Date,
  ): boolean {
    return (
      sanction.status === OperationalSanctionStatus.Active &&
      (!sanction.endsAt || sanction.endsAt.getTime() > asOf.getTime())
    );
  }
}
