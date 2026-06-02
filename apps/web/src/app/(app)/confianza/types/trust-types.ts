import { TripClosureIncidentType } from '@saferidepro/shared-types';

export type RatingDraft = {
  score: string;
  comment: string;
};

export type ReportDraft = {
  reason: string;
  description: string;
  evidenceFileKey: string;
  evidenceFileName: string;
  evidencePreviewUrl: string | null;
  evidenceMimeType: string | null;
};

export const EMPTY_RATING_DRAFT: RatingDraft = {
  score: '0',
  comment: '',
};

export type RatingParticipationOpportunity = {
  id: string;
  tripId: string;
  targetMembershipId: string;
  targetFullName: string;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: string;
  ratingDirectionLabel: string;
  windowClosesAt: string;
};

export type ReportParticipationOpportunity = {
  id: string;
  tripId: string;
  targetMembershipId: string;
  targetFullName: string;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: string;
  reportDirectionLabel: string;
  incidentType: TripClosureIncidentType;
  incidentLabel: string;
  incidentTone: 'neutral' | 'success' | 'warning' | 'danger';
  incidentSummary: string;
  suggestedReason: string;
  tripClosureNote: string | null;
  windowClosesAt: string;
};
