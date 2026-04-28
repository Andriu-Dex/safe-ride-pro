import {
  MembershipStatus,
  TripStatus,
} from '@saferidepro/shared-types';

export const RATINGS_REPOSITORY = Symbol('RATINGS_REPOSITORY');

export type RatingMembershipRecord = {
  id: string;
  userId: string;
  fullName: string;
  institutionId: string;
  institutionName: string;
  membershipStatus: MembershipStatus;
};

export type RatingTripRecord = {
  id: string;
  institutionId: string;
  institutionName: string;
  status: TripStatus;
  driverMembershipId: string;
  driverUserId: string;
  driverFullName: string;
  originLabel: string;
  destinationLabel: string;
  departureAt: Date;
  estimatedArrivalAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
};

export type RatingRecord = {
  id: string;
  tripId: string;
  institutionId: string;
  institutionName: string;
  authorMembershipId: string;
  authorUserId: string;
  authorFullName: string;
  targetMembershipId: string;
  targetUserId: string;
  targetFullName: string;
  tripStatus: TripStatus;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: Date;
  score: number;
  comment: string | null;
  createdAt: Date;
};

export type CreateRatingInput = {
  tripId: string;
  authorMembershipId: string;
  targetMembershipId: string;
  score: number;
  comment?: string;
};

export interface RatingsRepository {
  findDefaultMembershipByUserId(userId: string): Promise<RatingMembershipRecord | null>;
  findTripById(tripId: string): Promise<RatingTripRecord | null>;
  hasAcceptedTripRequest(tripId: string, passengerMembershipId: string): Promise<boolean>;
  findRatingByTripAuthorAndTarget(
    tripId: string,
    authorMembershipId: string,
    targetMembershipId: string,
  ): Promise<RatingRecord | null>;
  createRating(input: CreateRatingInput): Promise<RatingRecord>;
  listRatingsForMembershipId(membershipId: string): Promise<RatingRecord[]>;
}
