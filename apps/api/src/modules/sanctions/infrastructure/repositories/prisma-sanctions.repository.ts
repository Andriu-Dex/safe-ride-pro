import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CancellationTiming,
  getCancellationTiming,
  getReportSeverity,
  MembershipStatus,
  OperationalSanctionAppealStatus,
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
  ReportSeverity,
  SANCTION_OPERATIONAL_WINDOW_DAYS,
  SANCTION_RECURRENCE_WINDOW_DAYS,
  SANCTION_REPORTS_WINDOW_DAYS,
  type OperationalSanctionMetrics,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CreateOperationalSanctionAppealInput,
  CreateOperationalSanctionInput,
  ListReviewableOperationalSanctionAppealsInput,
  ListReviewableOperationalSanctionsInput,
  OperationalSanctionAppealRecord,
  OperationalSanctionDetailRecord,
  OperationalSanctionRecord,
  RecentSanctionHistory,
  ReviewOperationalSanctionAppealInput,
  SanctionsRepository,
} from '../../application/ports/sanctions.repository';

@Injectable()
export class PrismaSanctionsRepository implements SanctionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findInstitutionIdByMembershipId(membershipId: string): Promise<string | null> {
    const membership = await this.prisma.userInstitutionMembership.findUnique({
      where: { id: membershipId },
      select: {
        institutionId: true,
      },
    });

    return membership?.institutionId ?? null;
  }

  async getRecentMetrics(
    membershipId: string,
    asOf: Date,
  ): Promise<OperationalSanctionMetrics> {
    const operationalWindowStart = new Date(asOf);
    operationalWindowStart.setDate(
      operationalWindowStart.getDate() - SANCTION_OPERATIONAL_WINDOW_DAYS,
    );

    const reportsWindowStart = new Date(asOf);
    reportsWindowStart.setDate(reportsWindowStart.getDate() - SANCTION_REPORTS_WINDOW_DAYS);

    const [
      cancelledTripsAsDriver,
      cancelledTripRequestsAsPassenger,
      passengerNoShows,
      resolvedReportsReceived,
    ] = await Promise.all([
      this.prisma.trip.findMany({
        where: {
          driverMembershipId: membershipId,
          status: 'CANCELLED',
          cancelledAt: {
            not: null,
            gte: operationalWindowStart,
          },
        },
        select: {
          departureAt: true,
          cancelledAt: true,
        },
      }),
      this.prisma.tripRequest.findMany({
        where: {
          passengerMembershipId: membershipId,
          status: 'CANCELLED',
          cancelledAt: {
            not: null,
            gte: operationalWindowStart,
          },
        },
        select: {
          cancelledAt: true,
          trip: {
            select: {
              departureAt: true,
            },
          },
        },
      }),
      this.prisma.tripRequest.count({
        where: {
          passengerMembershipId: membershipId,
          status: 'NO_SHOW',
          reviewedAt: {
            not: null,
            gte: operationalWindowStart,
          },
        },
      }),
      this.prisma.report.findMany({
        where: {
          reportedMembershipId: membershipId,
          status: 'RESOLVED',
          reviewedAt: {
            not: null,
            gte: reportsWindowStart,
          },
        },
        select: {
          reason: true,
        },
      }),
    ]);

    const resolvedReportSeverityCounts =
      this.countResolvedReportsBySeverity(resolvedReportsReceived);

    return {
      lateDriverTripCancellations: cancelledTripsAsDriver.filter((trip) =>
        getCancellationTiming({
          departureAt: trip.departureAt,
          cancelledAt: trip.cancelledAt,
        }) === CancellationTiming.Late,
      ).length,
      latePassengerTripRequestCancellations: cancelledTripRequestsAsPassenger.filter(
        (tripRequest) =>
          getCancellationTiming({
            departureAt: tripRequest.trip.departureAt,
            cancelledAt: tripRequest.cancelledAt,
          }) === CancellationTiming.Late,
      ).length,
      passengerNoShows,
      resolvedReportsReceived: resolvedReportsReceived.length,
      resolvedLowSeverityReportsReceived: resolvedReportSeverityCounts.low,
      resolvedMediumSeverityReportsReceived: resolvedReportSeverityCounts.medium,
      resolvedHighSeverityReportsReceived: resolvedReportSeverityCounts.high,
    };
  }

  async getRecentSanctionHistory(
    membershipId: string,
    asOf: Date,
  ): Promise<RecentSanctionHistory> {
    const recurrenceWindowStart = new Date(asOf);
    recurrenceWindowStart.setDate(
      recurrenceWindowStart.getDate() - SANCTION_RECURRENCE_WINDOW_DAYS,
    );

    const [recentSanctionCount, recentBlockingSanctionCount] = await Promise.all([
      this.prisma.operationalSanction.count({
        where: {
          membershipId,
          startedAt: {
            gte: recurrenceWindowStart,
          },
        },
      }),
      this.prisma.operationalSanction.count({
        where: {
          membershipId,
          startedAt: {
            gte: recurrenceWindowStart,
          },
          type: {
            not: 'WARNING',
          },
        },
      }),
    ]);

    return {
      recentSanctionCount,
      recentBlockingSanctionCount,
      recurrenceWindowDays: SANCTION_RECURRENCE_WINDOW_DAYS,
    };
  }

  async countRecentBlockingSanctionsByScope(
    membershipId: string,
    scope: OperationalSanctionScope,
    asOf: Date,
  ): Promise<number> {
    const recurrenceWindowStart = new Date(asOf);
    recurrenceWindowStart.setDate(
      recurrenceWindowStart.getDate() - SANCTION_RECURRENCE_WINDOW_DAYS,
    );

    return this.prisma.operationalSanction.count({
      where: {
        membershipId,
        scope,
        startedAt: {
          gte: recurrenceWindowStart,
        },
        type: {
          not: 'WARNING',
        },
      },
    });
  }

  async listActiveSanctions(
    membershipId: string,
    asOf: Date,
  ): Promise<OperationalSanctionRecord[]> {
    const sanctions = await this.prisma.operationalSanction.findMany({
      where: {
        membershipId,
        status: 'ACTIVE',
        OR: [
          {
            endsAt: null,
          },
          {
            endsAt: {
              gt: asOf,
            },
          },
        ],
      },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return sanctions.map((sanction) => this.mapSanction(sanction));
  }

  async listManuallyLiftedAutomaticSanctions(
    membershipId: string,
    asOf: Date,
  ): Promise<OperationalSanctionRecord[]> {
    const recurrenceWindowStart = new Date(asOf);
    recurrenceWindowStart.setDate(
      recurrenceWindowStart.getDate() - SANCTION_RECURRENCE_WINDOW_DAYS,
    );

    const sanctions = await this.prisma.operationalSanction.findMany({
      where: {
        membershipId,
        isAutomatic: true,
        status: 'EXPIRED',
        expiredAt: {
          not: null,
          gte: recurrenceWindowStart,
        },
      },
      orderBy: [{ expiredAt: 'desc' }, { createdAt: 'desc' }],
    });

    return sanctions
      .map((sanction) => this.mapSanction(sanction))
      .filter((sanction) => this.hasManualLiftMetadata(sanction.metadata));
  }

  async findSanctionDetailById(
    sanctionId: string,
  ): Promise<OperationalSanctionDetailRecord | null> {
    const sanction = await this.prisma.operationalSanction.findUnique({
      where: { id: sanctionId },
      include: this.sanctionDetailInclude(),
    });

    return sanction ? this.mapSanctionDetail(sanction) : null;
  }

  async listReviewableActiveSanctions(
    input: ListReviewableOperationalSanctionsInput,
  ): Promise<OperationalSanctionDetailRecord[]> {
    const sanctions = await this.prisma.operationalSanction.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          {
            endsAt: null,
          },
          {
            endsAt: {
              gt: input.asOf,
            },
          },
        ],
        ...(input.institutionIds?.length
          ? {
              membership: {
                institutionId: {
                  in: input.institutionIds,
                },
                ...(input.userId ? { userId: input.userId } : {}),
              },
            }
          : input.userId
            ? {
                membership: {
                  userId: input.userId,
                },
              }
            : {}),
      },
      include: this.sanctionDetailInclude(),
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      take: input.limit ?? 50,
    });

    return sanctions.map((sanction) => this.mapSanctionDetail(sanction));
  }

  async expireElapsedSanctions(
    membershipId: string,
    asOf: Date,
  ): Promise<OperationalSanctionRecord[]> {
    const sanctions = await this.prisma.operationalSanction.findMany({
      where: {
        membershipId,
        status: 'ACTIVE',
        endsAt: {
          not: null,
          lte: asOf,
        },
      },
      orderBy: [{ endsAt: 'asc' }, { createdAt: 'asc' }],
    });

    if (!sanctions.length) {
      return [];
    }

    const updatedSanctions = await Promise.all(
      sanctions.map((sanction) =>
        this.prisma.operationalSanction.update({
          where: { id: sanction.id },
          data: {
            status: 'EXPIRED',
            expiredAt: asOf,
          },
        }),
      ),
    );

    return updatedSanctions.map((sanction) => this.mapSanction(sanction));
  }

  async expireSanction(
    sanctionId: string,
    asOf: Date,
    metadata?: Record<string, unknown>,
  ): Promise<OperationalSanctionRecord> {
    const sanction = await this.prisma.operationalSanction.update({
      where: { id: sanctionId },
      data: {
        status: 'EXPIRED',
        expiredAt: asOf,
        ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
      },
    });

    return this.mapSanction(sanction);
  }

  async createOperationalSanction(
    input: CreateOperationalSanctionInput,
  ): Promise<OperationalSanctionRecord> {
    const sanction = await this.prisma.operationalSanction.create({
      data: {
        membershipId: input.membershipId,
        type: input.type,
        scope: input.scope,
        trigger: input.trigger,
        reason: input.reason,
        isAutomatic: input.isAutomatic,
        startedAt: input.startedAt,
        endsAt: input.endsAt,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    return this.mapSanction(sanction);
  }

  async findAppealBySanctionId(
    sanctionId: string,
  ): Promise<OperationalSanctionAppealRecord | null> {
    const appeal = await this.prisma.operationalSanctionAppeal.findUnique({
      where: { sanctionId },
      include: this.appealInclude(),
    });

    return appeal ? this.mapAppeal(appeal) : null;
  }

  async findAppealById(
    appealId: string,
  ): Promise<OperationalSanctionAppealRecord | null> {
    const appeal = await this.prisma.operationalSanctionAppeal.findUnique({
      where: { id: appealId },
      include: this.appealInclude(),
    });

    return appeal ? this.mapAppeal(appeal) : null;
  }

  async createOperationalSanctionAppeal(
    input: CreateOperationalSanctionAppealInput,
  ): Promise<OperationalSanctionAppealRecord> {
    const appeal = await this.prisma.operationalSanctionAppeal.create({
      data: {
        sanctionId: input.sanctionId,
        requestedByUserId: input.requestedByUserId,
        reason: input.reason,
      },
      include: this.appealInclude(),
    });

    return this.mapAppeal(appeal);
  }

  async listAppealsByRequestedByUserId(
    userId: string,
  ): Promise<OperationalSanctionAppealRecord[]> {
    const appeals = await this.prisma.operationalSanctionAppeal.findMany({
      where: {
        requestedByUserId: userId,
      },
      include: this.appealInclude(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return appeals.map((appeal) => this.mapAppeal(appeal));
  }

  async listReviewableOperationalSanctionAppeals(
    input: ListReviewableOperationalSanctionAppealsInput,
  ): Promise<OperationalSanctionAppealRecord[]> {
    const appeals = await this.prisma.operationalSanctionAppeal.findMany({
      where: {
        ...(input.institutionIds?.length
          ? {
              sanction: {
                membership: {
                  institutionId: {
                    in: input.institutionIds,
                  },
                },
              },
            }
          : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      include: this.appealInclude(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit ?? 50,
    });

    return appeals.map((appeal) => this.mapAppeal(appeal));
  }

  async reviewOperationalSanctionAppeal(
    input: ReviewOperationalSanctionAppealInput,
  ): Promise<OperationalSanctionAppealRecord> {
    const appeal = await this.prisma.operationalSanctionAppeal.update({
      where: { id: input.appealId },
      data: {
        status: input.status,
        reviewNote: input.reviewNote,
        reviewedAt: new Date(),
        reviewedByUserId: input.reviewerUserId,
      },
      include: this.appealInclude(),
    });

    return this.mapAppeal(appeal);
  }

  private countResolvedReportsBySeverity(
    reports: { reason: string }[],
  ): {
    low: number;
    medium: number;
    high: number;
  } {
    return reports.reduce(
      (totals, report) => {
        const severity = getReportSeverity(report.reason);

        switch (severity) {
          case ReportSeverity.High:
            totals.high += 1;
            return totals;
          case ReportSeverity.Medium:
            totals.medium += 1;
            return totals;
          case ReportSeverity.Low:
          default:
            totals.low += 1;
            return totals;
        }
      },
      {
        low: 0,
        medium: 0,
        high: 0,
      },
    );
  }

  private hasManualLiftMetadata(metadata: Record<string, unknown> | null): boolean {
    return (
      !!metadata &&
      typeof metadata.manualLift === 'object' &&
      metadata.manualLift !== null
    );
  }

  private sanctionDetailInclude() {
    return {
      membership: {
        include: {
          institution: true,
          user: true,
        },
      },
    } as const;
  }

  private appealInclude() {
    return {
      sanction: {
        include: {
          membership: {
            include: {
              institution: true,
              user: true,
            },
          },
        },
      },
      requestedByUser: true,
      reviewedByUser: true,
    } as const;
  }

  private mapSanction(sanction: {
    id: string;
    membershipId: string;
    type: string;
    scope: string;
    status: string;
    trigger: string;
    reason: string;
    isAutomatic: boolean;
    startedAt: Date;
    endsAt: Date | null;
    expiredAt: Date | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): OperationalSanctionRecord {
    return {
      id: sanction.id,
      membershipId: sanction.membershipId,
      type: sanction.type as OperationalSanctionType,
      scope: sanction.scope as OperationalSanctionScope,
      status: sanction.status as OperationalSanctionStatus,
      trigger: sanction.trigger as OperationalSanctionTrigger,
      reason: sanction.reason,
      isAutomatic: sanction.isAutomatic,
      startedAt: sanction.startedAt,
      endsAt: sanction.endsAt,
      expiredAt: sanction.expiredAt,
      metadata:
        sanction.metadata &&
        typeof sanction.metadata === 'object' &&
        !Array.isArray(sanction.metadata)
          ? (sanction.metadata as Record<string, unknown>)
          : null,
      createdAt: sanction.createdAt,
      updatedAt: sanction.updatedAt,
    };
  }

  private mapSanctionDetail(sanction: {
    id: string;
    membershipId: string;
    type: string;
    scope: string;
    status: string;
    trigger: string;
    reason: string;
    isAutomatic: boolean;
    startedAt: Date;
    endsAt: Date | null;
    expiredAt: Date | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    membership: {
      membershipStatus: string;
      institution: {
        id: string;
        name: string;
        isActive: boolean;
      };
      user: {
        id: string;
        fullName: string;
      };
    };
  }): OperationalSanctionDetailRecord {
    return {
      ...this.mapSanction(sanction),
      institutionId: sanction.membership.institution.id,
      institutionName: sanction.membership.institution.name,
      institutionIsActive: sanction.membership.institution.isActive,
      membershipStatus: sanction.membership.membershipStatus as MembershipStatus,
      membershipUserId: sanction.membership.user.id,
      membershipUserFullName: sanction.membership.user.fullName,
    };
  }

  private mapAppeal(appeal: {
    id: string;
    sanctionId: string;
    requestedByUserId: string;
    reason: string;
    status: string;
    reviewNote: string | null;
    reviewedAt: Date | null;
    reviewedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    sanction: {
      id: string;
      membershipId: string;
      type: string;
      scope: string;
      status: string;
      trigger: string;
      reason: string;
      startedAt: Date;
      endsAt: Date | null;
      membership: {
        membershipStatus: string;
        institution: {
          id: string;
          name: string;
          isActive: boolean;
        };
        user: {
          id: string;
          fullName: string;
        };
      };
    };
    requestedByUser: {
      fullName: string;
    };
    reviewedByUser: {
      fullName: string;
    } | null;
  }): OperationalSanctionAppealRecord {
    return {
      id: appeal.id,
      sanctionId: appeal.sanctionId,
      sanctionType: appeal.sanction.type as OperationalSanctionType,
      sanctionScope: appeal.sanction.scope as OperationalSanctionScope,
      sanctionStatus: appeal.sanction.status as OperationalSanctionStatus,
      sanctionTrigger: appeal.sanction.trigger as OperationalSanctionTrigger,
      sanctionReason: appeal.sanction.reason,
      sanctionStartedAt: appeal.sanction.startedAt,
      sanctionEndsAt: appeal.sanction.endsAt,
      institutionId: appeal.sanction.membership.institution.id,
      institutionName: appeal.sanction.membership.institution.name,
      institutionIsActive: appeal.sanction.membership.institution.isActive,
      membershipId: appeal.sanction.membershipId,
      membershipStatus: appeal.sanction.membership.membershipStatus as MembershipStatus,
      affectedUserId: appeal.sanction.membership.user.id,
      affectedFullName: appeal.sanction.membership.user.fullName,
      requestedByUserId: appeal.requestedByUserId,
      requestedByFullName: appeal.requestedByUser.fullName,
      status: appeal.status as OperationalSanctionAppealStatus,
      reason: appeal.reason,
      reviewNote: appeal.reviewNote,
      reviewedAt: appeal.reviewedAt,
      reviewedByUserId: appeal.reviewedByUserId,
      reviewedByFullName: appeal.reviewedByUser?.fullName ?? null,
      createdAt: appeal.createdAt,
      updatedAt: appeal.updatedAt,
    };
  }
}
