import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CancellationTiming,
  getCancellationTiming,
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
  SANCTION_OPERATIONAL_WINDOW_DAYS,
  SANCTION_REPORTS_WINDOW_DAYS,
  type OperationalSanctionMetrics,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CreateOperationalSanctionInput,
  OperationalSanctionRecord,
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
      this.prisma.report.count({
        where: {
          reportedMembershipId: membershipId,
          status: 'RESOLVED',
          reviewedAt: {
            not: null,
            gte: reportsWindowStart,
          },
        },
      }),
    ]);

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
      resolvedReportsReceived,
    };
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
  ): Promise<OperationalSanctionRecord> {
    const sanction = await this.prisma.operationalSanction.update({
      where: { id: sanctionId },
      data: {
        status: 'EXPIRED',
        expiredAt: asOf,
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
        sanction.metadata && typeof sanction.metadata === 'object' && !Array.isArray(sanction.metadata)
          ? (sanction.metadata as Record<string, unknown>)
          : null,
      createdAt: sanction.createdAt,
      updatedAt: sanction.updatedAt,
    };
  }
}
