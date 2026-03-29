import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
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
  getCancellationTiming,
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
  TrustSummary,
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

  async updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName?.trim(),
        phone: input.phone?.trim(),
        profilePhotoUrl: input.profilePhotoUrl?.trim(),
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

  async getTrustSummary(membershipId: string): Promise<TrustSummary> {
    const computedAt = new Date();

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
        },
      }),
      this.prisma.report.count({
        where: {
          reportedMembershipId: membershipId,
          status: 'RESOLVED',
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
      resolvedReportsReceived,
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
    phone: string | null;
    documentType: DocumentType;
    documentNumber: string;
    profilePhotoUrl: string | null;
    globalRole: GlobalUserRole;
    accountStatus: AccountStatus;
    emailVerifiedAt: Date | null;
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
      institution: { name: string };
    }[];
  }): UserProfile {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      documentType: user.documentType,
      documentNumber: user.documentNumber,
      profilePhotoUrl: user.profilePhotoUrl,
      globalRole: user.globalRole as unknown as SharedGlobalUserRole,
      accountStatus: user.accountStatus as unknown as SharedAccountStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      memberships: user.memberships.map((membership) => ({
        id: membership.id,
        institutionId: membership.institutionId,
        institutionName: membership.institution.name,
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
