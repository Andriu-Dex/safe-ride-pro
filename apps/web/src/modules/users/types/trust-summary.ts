export type TrustSummary = {
  membershipId: string;
  averageRatingReceived: number | null;
  totalRatingsReceived: number;
  completedTripsAsDriver: number;
  completedTripsAsPassenger: number;
  lateDriverTripCancellations: number;
  latePassengerTripRequestCancellations: number;
  passengerNoShows: number;
  resolvedReportsReceived: number;
  cancellationPolicy: {
    lateWindowMinutes: number;
    lastComputedAt: string;
  };
};
