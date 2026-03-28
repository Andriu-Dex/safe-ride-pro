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
  tripStatus: import('@saferidepro/shared-types').TripStatus;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: string;
  score: number;
  comment: string | null;
  createdAt: string;
};

export type RatingList = {
  given: RatingRecord[];
  received: RatingRecord[];
};

export type CreateRatingInput = {
  tripId: string;
  targetMembershipId: string;
  score: number;
  comment?: string;
};
