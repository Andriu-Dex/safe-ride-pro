import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  MembershipStatus,
  ReportStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CreateReportInput,
  ListReviewableReportsInput,
  ReportMembershipRecord,
  ReportRecord,
  ReportsRepository,
  ReportTripRecord,
  ReviewReportInput,
} from '../../application/ports/reports.repository';

@Injectable()
export class PrismaReportsRepository implements ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get client(): PrismaClient {
    return this.prisma as PrismaClient;
  }

  async findDefaultMembershipByUserId(userId: string): Promise<ReportMembershipRecord | null> {
    const membership = await this.prisma.userInstitutionMembership.findFirst({
      where: {
        userId,
        membershipStatus: 'ACTIVE',
        institution: {
          isActive: true,
        },
      },
      include: {
        institution: true,
        user: true,
      },
      orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
    });

    if (!membership) {
      return null;
    }

    return {
      id: membership.id,
      userId: membership.userId,
      fullName: membership.user.fullName,
      institutionId: membership.institutionId,
      institutionName: membership.institution.name,
      membershipStatus: membership.membershipStatus as MembershipStatus,
    };
  }

  async findTripById(tripId: string): Promise<ReportTripRecord | null> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        institution: true,
        driverMembership: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!trip) {
      return null;
    }

    return {
      id: trip.id,
      institutionId: trip.institutionId,
      institutionName: trip.institution.name,
      status: trip.status as TripStatus,
      driverMembershipId: trip.driverMembershipId,
      driverUserId: trip.driverMembership.userId,
      driverFullName: trip.driverMembership.user.fullName,
      originLabel: trip.originLabel,
      destinationLabel: trip.destinationLabel,
      departureAt: trip.departureAt,
      estimatedArrivalAt: trip.estimatedArrivalAt,
      completedAt: trip.completedAt,
      cancelledAt: trip.cancelledAt,
    };
  }

  async hasReportableTripParticipation(
    tripId: string,
    passengerMembershipId: string,
  ): Promise<boolean> {
    const tripParticipation = await this.prisma.tripRequest.findFirst({
      where: {
        tripId,
        passengerMembershipId,
        OR: [{ status: 'ACCEPTED' }, { status: 'NO_SHOW' }, { status: 'CANCELLED' }],
      },
      select: {
        status: true,
        reviewedAt: true,
        cancelledAt: true,
        trip: {
          select: {
            cancelledAt: true,
          },
        },
      },
    });

    if (!tripParticipation) {
      return false;
    }

    if (tripParticipation.status === 'ACCEPTED' || tripParticipation.status === 'NO_SHOW') {
      return true;
    }

    return Boolean(
      tripParticipation.reviewedAt &&
        tripParticipation.cancelledAt &&
        tripParticipation.trip.cancelledAt &&
        tripParticipation.cancelledAt.getTime() === tripParticipation.trip.cancelledAt.getTime(),
    );
  }

  async findReportById(reportId: string): Promise<ReportRecord | null> {
    const report = await this.client.report.findUnique({
      where: { id: reportId },
      include: this.reportInclude(),
    });

    return report ? this.mapReport(report) : null;
  }

  async findExistingReport(
    tripId: string,
    reporterMembershipId: string,
    reportedMembershipId: string,
  ): Promise<ReportRecord | null> {
    const report = await this.client.report.findUnique({
      where: {
        tripId_reporterMembershipId_reportedMembershipId: {
          tripId,
          reporterMembershipId,
          reportedMembershipId,
        },
      },
      include: this.reportInclude(),
    });

    return report ? this.mapReport(report) : null;
  }

  async createReport(input: CreateReportInput): Promise<ReportRecord> {
    const report = await this.client.report.create({
      data: {
        tripId: input.tripId,
        reporterMembershipId: input.reporterMembershipId,
        reportedMembershipId: input.reportedMembershipId,
        reason: input.reason,
        description: input.description,
        evidenceFileKey: input.evidenceFileKey,
      },
      include: this.reportInclude(),
    });

    return this.mapReport(report);
  }

  async listReportsByReporterMembershipId(reporterMembershipId: string): Promise<ReportRecord[]> {
    const reports = await this.client.report.findMany({
      where: { reporterMembershipId },
      include: this.reportInclude(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return reports.map((reportRecord) => this.mapReport(reportRecord));
  }

  async listReviewableReports(input: ListReviewableReportsInput): Promise<ReportRecord[]> {
    const reports = await this.client.report.findMany({
      where: {
        ...(input.institutionIds?.length
          ? {
              trip: {
                institutionId: {
                  in: input.institutionIds,
                },
              },
            }
          : {}),
        ...(input.status ? { status: input.status } : {}),
      },
      include: this.reportInclude(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit ?? 50,
    });

    return reports.map((reportRecord) => this.mapReport(reportRecord));
  }

  async reviewReport(input: ReviewReportInput): Promise<ReportRecord> {
    const report = await this.client.report.update({
      where: { id: input.reportId },
      data: {
        status: input.status,
        reviewNote: input.reviewNote,
        reviewedAt: new Date(),
        reviewedByUserId: input.reviewerUserId,
      },
      include: this.reportInclude(),
    });

    return this.mapReport(report);
  }

  private reportInclude() {
    return {
      trip: {
        include: {
          institution: true,
        },
      },
      reporterMembership: {
        include: {
          user: true,
        },
      },
      reportedMembership: {
        include: {
          user: true,
        },
      },
      reviewedByUser: true,
    } as const;
  }

  private mapReport(report: {
    id: string;
    tripId: string;
    reporterMembershipId: string;
    reportedMembershipId: string;
    status: string;
    reason: string;
    description: string | null;
    evidenceFileKey: string | null;
    reviewNote: string | null;
    reviewedAt: Date | null;
    reviewedByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    trip: {
      institutionId: string;
      status: string;
      originLabel: string;
      destinationLabel: string;
      departureAt: Date;
      completedAt: Date | null;
      closureNote: string | null;
      institution: {
        name: string;
      };
    };
    reporterMembership: {
      userId: string;
      user: {
        fullName: string;
      };
    };
    reportedMembership: {
      userId: string;
      user: {
        fullName: string;
      };
    };
    reviewedByUser: {
      fullName: string;
    } | null;
  }): ReportRecord {
    return {
      id: report.id,
      tripId: report.tripId,
      institutionId: report.trip.institutionId,
      institutionName: report.trip.institution.name,
      reporterMembershipId: report.reporterMembershipId,
      reporterUserId: report.reporterMembership.userId,
      reporterFullName: report.reporterMembership.user.fullName,
      reportedMembershipId: report.reportedMembershipId,
      reportedUserId: report.reportedMembership.userId,
      reportedFullName: report.reportedMembership.user.fullName,
      tripStatus: report.trip.status as TripStatus,
      tripOriginLabel: report.trip.originLabel,
      tripDestinationLabel: report.trip.destinationLabel,
      tripDepartureAt: report.trip.departureAt,
      tripCompletedAt: report.trip.completedAt,
      tripClosureNote: report.trip.closureNote,
      status: report.status as ReportStatus,
      reason: report.reason,
      description: report.description,
      evidenceFileKey: report.evidenceFileKey,
      reviewNote: report.reviewNote,
      reviewedAt: report.reviewedAt,
      reviewedByUserId: report.reviewedByUserId,
      reviewedByFullName: report.reviewedByUser?.fullName ?? null,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }
}
