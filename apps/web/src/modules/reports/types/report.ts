import { ReportStatus, TripStatus } from '@saferidepro/shared-types';

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
  tripDepartureAt: string;
  status: ReportStatus;
  reason: string;
  description: string | null;
  evidenceFileKey: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByFullName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateReportInput = {
  tripId: string;
  reportedMembershipId: string;
  reason: string;
  description?: string;
  evidenceFileKey?: string;
};

export type ReviewReportInput = {
  status: ReportStatus;
  reviewNote?: string;
};
