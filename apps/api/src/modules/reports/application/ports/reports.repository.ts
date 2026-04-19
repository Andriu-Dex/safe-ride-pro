import {
  MembershipStatus,
  ReportStatus,
  TripStatus,
} from '@saferidepro/shared-types';

export const REPORTS_REPOSITORY = Symbol('REPORTS_REPOSITORY');

export type ReportMembershipRecord = {
  id: string;
  userId: string;
  fullName: string;
  institutionId: string;
  institutionName: string;
  membershipStatus: MembershipStatus;
};

export type ReportTripRecord = {
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
  cancelledAt: Date | null;
};

export type ReportRecord = {
  id: string;
  tripId: string;
  institutionId: string;
  institutionName: string;
  reporterMembershipId: string;
  reporterUserId: string;
  reporterFullName: string;
  reportedMembershipId: string;
  reportedUserId: string;
  reportedFullName: string;
  tripStatus: TripStatus;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: Date;
  status: ReportStatus;
  reason: string;
  description: string | null;
  evidenceFileKey: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  reviewedByFullName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateReportInput = {
  tripId: string;
  reporterMembershipId: string;
  reportedMembershipId: string;
  reason: string;
  description?: string;
  evidenceFileKey?: string;
};

export type ReviewReportInput = {
  reportId: string;
  reviewerUserId: string;
  status: ReportStatus;
  reviewNote?: string;
};

export type ListReviewableReportsInput = {
  institutionIds?: string[];
  status?: ReportStatus;
  limit?: number;
};

export interface ReportsRepository {
  findDefaultMembershipByUserId(userId: string): Promise<ReportMembershipRecord | null>;
  findTripById(tripId: string): Promise<ReportTripRecord | null>;
  hasReportableTripParticipation(tripId: string, passengerMembershipId: string): Promise<boolean>;
  findReportById(reportId: string): Promise<ReportRecord | null>;
  findExistingReport(
    tripId: string,
    reporterMembershipId: string,
    reportedMembershipId: string,
  ): Promise<ReportRecord | null>;
  createReport(input: CreateReportInput): Promise<ReportRecord>;
  listReportsByReporterMembershipId(reporterMembershipId: string): Promise<ReportRecord[]>;
  listReviewableReports(input: ListReviewableReportsInput): Promise<ReportRecord[]>;
  reviewReport(input: ReviewReportInput): Promise<ReportRecord>;
}
