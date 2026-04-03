import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  AssetStorageProvider,
  DocumentType,
  DriverVerificationStatus,
  GlobalUserRole,
  MembershipRole,
  MembershipStatus,
} from '@prisma/client';
import {
  AccountStatus as SharedAccountStatus,
  CancellationTiming,
  CANCELLATION_LATE_WINDOW_MINUTES,
  deriveUserOnboardingState,
  getCancellationTiming,
  getReportSeverity,
  ReportSeverity,
  SANCTION_OPERATIONAL_WINDOW_DAYS,
  SANCTION_REPORTS_WINDOW_DAYS,
  getDaysUntilDriverLicenseExpiration,
  getDriverLicenseStatus,
  getEffectiveDriverVerificationStatus,
  DriverVerificationStatus as SharedDriverVerificationStatus,
  GlobalUserRole as SharedGlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus as SharedMembershipStatus,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  TrustSummaryMetrics,
  UpdateUserProfileInput,
  UserProfile,
  UsersRepository,
} from '../../application/ports/users.repository';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            institution: true,
            driverProfile: {
              select: {
                licenseExpiresAt: true,
              },
            },
          },
          orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
        },
      },
    });

    return user ? this.mapUser(user) : null;
  }

  async findProfilePhotoRecordById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        profilePhotoUrl: true,
        profilePhotoStorageProvider: true,
        profilePhotoStorageKey: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      profilePhotoUrl: user.profilePhotoUrl,
      profilePhotoStorageProvider: user.profilePhotoStorageProvider,
      profilePhotoStorageKey: user.profilePhotoStorageKey,
    };
  }

  async updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName?.trim(),
        career: input.career?.trim(),
        phone:
          input.phone === undefined
            ? undefined
            : input.phone?.trim() || null,
        referenceNeighborhood: input.referenceNeighborhood?.trim(),
        profilePhotoUrl:
          input.profilePhotoUrl === undefined
            ? undefined
            : input.profilePhotoUrl?.trim() || null,
        termsAcceptedAt: input.termsAcceptedAt,
        privacyAcceptedAt: input.privacyAcceptedAt,
        safetyRulesAcceptedAt: input.safetyRulesAcceptedAt,
        onboardingCompletedAt:
          input.onboardingCompletedAt === undefined
            ? undefined
            : input.onboardingCompletedAt,
      },
      include: {
        memberships: {
          include: {
            institution: true,
            driverProfile: {
              select: {
                licenseExpiresAt: true,
              },
            },
          },
          orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
        },
      },
    }).catch(() => null);

    if (!user) {
      throw new NotFoundException('El usuario solicitado no existe.');
    }

    return this.mapUser(user);
  }

  async updateProfilePhoto(
    userId: string,
    input: {
      profilePhotoUrl: string | null;
      profilePhotoStorageProvider: string | null;
      profilePhotoStorageKey: string | null;
    },
  ): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profilePhotoUrl: input.profilePhotoUrl,
        profilePhotoStorageProvider:
          input.profilePhotoStorageProvider === null
            ? null
            : (input.profilePhotoStorageProvider as AssetStorageProvider),
        profilePhotoStorageKey: input.profilePhotoStorageKey,
      },
      include: {
        memberships: {
          include: {
            institution: true,
            driverProfile: {
              select: {
                licenseExpiresAt: true,
              },
            },
          },
          orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
        },
      },
    }).catch(() => null);

    if (!user) {
      throw new NotFoundException('El usuario solicitado no existe.');
    }

    return this.mapUser(user);
  }

  async getTrustSummary(membershipId: string): Promise<TrustSummaryMetrics> {
    const computedAt = new Date();
    const operationalWindowStart = new Date(computedAt);
    operationalWindowStart.setDate(
      operationalWindowStart.getDate() - SANCTION_OPERATIONAL_WINDOW_DAYS,
    );
    const reportsWindowStart = new Date(computedAt);
    reportsWindowStart.setDate(reportsWindowStart.getDate() - SANCTION_REPORTS_WINDOW_DAYS);

    const [
      ratingAggregate,
      completedTripsAsDriver,
      completedTripsAsPassenger,
      cancelledTripsAsDriver,
      cancelledTripRequestsAsPassenger,
      passengerNoShows,
      resolvedReportsReceived,
    ] = await Promise.all([
      this.prisma.rating.aggregate({
        where: {
          targetMembershipId: membershipId,
        },
        _avg: {
          score: true,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.trip.count({
        where: {
          driverMembershipId: membershipId,
          status: 'COMPLETED',
        },
      }),
      this.prisma.tripRequest.count({
        where: {
          passengerMembershipId: membershipId,
          status: 'ACCEPTED',
          trip: {
            status: 'COMPLETED',
          },
        },
      }),
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

    const lateDriverTripCancellations = cancelledTripsAsDriver.filter((trip) =>
      getCancellationTiming({
        departureAt: trip.departureAt,
        cancelledAt: trip.cancelledAt,
      }) === CancellationTiming.Late,
    ).length;

    const latePassengerTripRequestCancellations = cancelledTripRequestsAsPassenger.filter(
      (tripRequest) =>
        getCancellationTiming({
          departureAt: tripRequest.trip.departureAt,
          cancelledAt: tripRequest.cancelledAt,
        }) === CancellationTiming.Late,
    ).length;

    const resolvedReportSeverityCounts = resolvedReportsReceived.reduce(
      (totals, report) => {
        const severity = getReportSeverity(report.reason);

        if (severity === ReportSeverity.High) {
          totals.high += 1;
          return totals;
        }

        if (severity === ReportSeverity.Medium) {
          totals.medium += 1;
          return totals;
        }

        totals.low += 1;
        return totals;
      },
      {
        low: 0,
        medium: 0,
        high: 0,
      },
    );

    return {
      membershipId,
      averageRatingReceived:
        ratingAggregate._avg.score === null ? null : Number(ratingAggregate._avg.score),
      totalRatingsReceived: ratingAggregate._count._all,
      completedTripsAsDriver,
      completedTripsAsPassenger,
      lateDriverTripCancellations,
      latePassengerTripRequestCancellations,
      passengerNoShows,
      resolvedReportsReceived: resolvedReportsReceived.length,
      resolvedLowSeverityReportsReceived: resolvedReportSeverityCounts.low,
      resolvedMediumSeverityReportsReceived: resolvedReportSeverityCounts.medium,
      resolvedHighSeverityReportsReceived: resolvedReportSeverityCounts.high,
      cancellationPolicy: {
        lateWindowMinutes: CANCELLATION_LATE_WINDOW_MINUTES,
        lastComputedAt: computedAt,
      },
    };
  }

  private mapUser(user: {
    id: string;
    email: string;
    fullName: string;
    career: string | null;
    phone: string | null;
    referenceNeighborhood: string | null;
    documentType: DocumentType;
    documentNumber: string;
    profilePhotoUrl: string | null;
    globalRole: GlobalUserRole;
    accountStatus: AccountStatus;
    emailVerifiedAt: Date | null;
    termsAcceptedAt: Date | null;
    privacyAcceptedAt: Date | null;
    safetyRulesAcceptedAt: Date | null;
    onboardingCompletedAt: Date | null;
    memberships: {
      id: string;
      institutionId: string;
      role: MembershipRole;
      membershipStatus: MembershipStatus;
      studentCode: string;
      isDefault: boolean;
      driverVerificationStatus: DriverVerificationStatus;
      driverProfile?: {
        licenseExpiresAt: Date;
      } | null;
      institution: { name: string; isActive: boolean };
    }[];
  }): UserProfile {
    const onboardingState = deriveUserOnboardingState({
      accountStatus: user.accountStatus,
      globalRole: user.globalRole,
      emailVerifiedAt: user.emailVerifiedAt,
      career: user.career,
      referenceNeighborhood: user.referenceNeighborhood,
      termsAcceptedAt: user.termsAcceptedAt,
      privacyAcceptedAt: user.privacyAcceptedAt,
      safetyRulesAcceptedAt: user.safetyRulesAcceptedAt,
      onboardingCompletedAt: user.onboardingCompletedAt,
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      career: user.career,
      phone: user.phone,
      referenceNeighborhood: user.referenceNeighborhood,
      documentType: user.documentType,
      documentNumber: user.documentNumber,
      profilePhotoUrl: user.profilePhotoUrl,
      globalRole: user.globalRole as unknown as SharedGlobalUserRole,
      accountStatus: user.accountStatus as unknown as SharedAccountStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      termsAcceptedAt: user.termsAcceptedAt,
      privacyAcceptedAt: user.privacyAcceptedAt,
      safetyRulesAcceptedAt: user.safetyRulesAcceptedAt,
      onboardingCompletedAt: user.onboardingCompletedAt,
      onboardingStatus: onboardingState.status,
      missingOnboardingRequirements: onboardingState.missingRequirements,
      requiresOnboarding: onboardingState.requiresOnboarding,
      memberships: user.memberships.map((membership) => ({
        id: membership.id,
        institutionId: membership.institutionId,
        institutionName: membership.institution.name,
        institutionIsActive: membership.institution.isActive,
        role: membership.role as unknown as InstitutionMembershipRole,
        membershipStatus: membership.membershipStatus as unknown as SharedMembershipStatus,
        studentCode: membership.studentCode,
        isDefault: membership.isDefault,
        driverVerificationStatus:
          membership.driverVerificationStatus as unknown as SharedDriverVerificationStatus,
        effectiveDriverVerificationStatus: getEffectiveDriverVerificationStatus(
          membership.driverVerificationStatus as unknown as SharedDriverVerificationStatus,
          membership.driverProfile?.licenseExpiresAt ?? null,
        ) as SharedDriverVerificationStatus,
        licenseExpiresAt: membership.driverProfile?.licenseExpiresAt ?? null,
        licenseStatus: getDriverLicenseStatus(membership.driverProfile?.licenseExpiresAt ?? null),
        licenseExpiresInDays: getDaysUntilDriverLicenseExpiration(
          membership.driverProfile?.licenseExpiresAt ?? null,
        ),
      })),
    };
  }
}
