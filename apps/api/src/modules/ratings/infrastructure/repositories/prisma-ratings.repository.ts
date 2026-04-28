import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  MembershipStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  CreateRatingInput,
  RatingMembershipRecord,
  RatingRecord,
  RatingsRepository,
  RatingTripRecord,
} from '../../application/ports/ratings.repository';

@Injectable()
export class PrismaRatingsRepository implements RatingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get client(): PrismaClient {
    return this.prisma as PrismaClient;
  }

  async findDefaultMembershipByUserId(userId: string): Promise<RatingMembershipRecord | null> {
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

  async findTripById(tripId: string): Promise<RatingTripRecord | null> {
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

  async hasAcceptedTripRequest(tripId: string, passengerMembershipId: string): Promise<boolean> {
    const acceptedTripRequest = await this.prisma.tripRequest.findFirst({
      where: {
        tripId,
        passengerMembershipId,
        status: 'ACCEPTED',
      },
      select: {
        id: true,
      },
    });

    return Boolean(acceptedTripRequest);
  }

  async findRatingByTripAuthorAndTarget(
    tripId: string,
    authorMembershipId: string,
    targetMembershipId: string,
  ): Promise<RatingRecord | null> {
    const rating = await this.client.rating.findUnique({
      where: {
        tripId_authorMembershipId_targetMembershipId: {
          tripId,
          authorMembershipId,
          targetMembershipId,
        },
      },
      include: this.ratingInclude(),
    });

    return rating ? this.mapRating(rating) : null;
  }

  async createRating(input: CreateRatingInput): Promise<RatingRecord> {
    const rating = await this.client.rating.create({
      data: {
        tripId: input.tripId,
        authorMembershipId: input.authorMembershipId,
        targetMembershipId: input.targetMembershipId,
        score: input.score,
        comment: input.comment,
      },
      include: this.ratingInclude(),
    });

    return this.mapRating(rating);
  }

  async listRatingsForMembershipId(membershipId: string): Promise<RatingRecord[]> {
    const ratings = await this.client.rating.findMany({
      where: {
        OR: [{ authorMembershipId: membershipId }, { targetMembershipId: membershipId }],
      },
      include: this.ratingInclude(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return ratings.map((ratingRecord) => this.mapRating(ratingRecord));
  }

  private ratingInclude() {
    return {
      trip: {
        include: {
          institution: true,
        },
      },
      authorMembership: {
        include: {
          user: true,
        },
      },
      targetMembership: {
        include: {
          user: true,
        },
      },
    } as const;
  }

  private mapRating(rating: {
    id: string;
    tripId: string;
    authorMembershipId: string;
    targetMembershipId: string;
    score: number;
    comment: string | null;
    createdAt: Date;
    trip: {
      institutionId: string;
      status: string;
      originLabel: string;
      destinationLabel: string;
      departureAt: Date;
      institution: {
        name: string;
      };
    };
    authorMembership: {
      userId: string;
      user: {
        fullName: string;
      };
    };
    targetMembership: {
      userId: string;
      user: {
        fullName: string;
      };
    };
  }): RatingRecord {
    return {
      id: rating.id,
      tripId: rating.tripId,
      institutionId: rating.trip.institutionId,
      institutionName: rating.trip.institution.name,
      authorMembershipId: rating.authorMembershipId,
      authorUserId: rating.authorMembership.userId,
      authorFullName: rating.authorMembership.user.fullName,
      targetMembershipId: rating.targetMembershipId,
      targetUserId: rating.targetMembership.userId,
      targetFullName: rating.targetMembership.user.fullName,
      tripStatus: rating.trip.status as TripStatus,
      tripOriginLabel: rating.trip.originLabel,
      tripDestinationLabel: rating.trip.destinationLabel,
      tripDepartureAt: rating.trip.departureAt,
      score: rating.score,
      comment: rating.comment,
      createdAt: rating.createdAt,
    };
  }
}
