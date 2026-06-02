import {
  canCreateTripRating,
  getTripPostClosureSummary,
  TripRequestStatus,
  TripClosureIncidentType,
} from '@saferidepro/shared-types';
import { ApiError } from '../../../../lib/api-client';
import { wasConfirmedBeforeClosure } from '../../../../modules/trip-requests/lib/trip-request-closure';
import type { TripRequestRecord } from '../../../../modules/trip-requests/types/trip-request';
import {
  getTripClosureIncidentLabel,
  getTripClosureIncidentTone,
} from '../../../../modules/trips/lib/trip-closure';
import {
  RatingParticipationOpportunity,
  ReportParticipationOpportunity,
  ReportDraft,
} from '../types/trust-types';

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

export function formatAverageScore(score: number | null): string {
  return score === null ? 'Sin datos' : `${score.toFixed(1)}/5`;
}

export function sortByDepartureDateDescending<T extends { tripDepartureAt: string }>(items: T[]): T[] {
  return items.sort(
    (left, right) =>
      new Date(right.tripDepartureAt).getTime() - new Date(left.tripDepartureAt).getTime(),
  );
}

export function getIncidentSummary(
  incidentType: TripClosureIncidentType,
): string {
  switch (incidentType) {
    case TripClosureIncidentType.Completed:
      return 'Viaje completado.';
    case TripClosureIncidentType.LateDriverCancellation:
      return 'Cancelacion tardia.';
    case TripClosureIncidentType.DriverAbsence:
      return 'Ausencia del conductor.';
    case TripClosureIncidentType.OverdueInProgress:
      return 'Viaje vencido sin cierre.';
    default:
      return 'Incidente operativo.';
  }
}

export function getSuggestedReportReason(incidentType: TripClosureIncidentType): string {
  switch (incidentType) {
    case TripClosureIncidentType.LateDriverCancellation:
    case TripClosureIncidentType.DriverAbsence:
      return 'NO_SHOW';
    case TripClosureIncidentType.OverdueInProgress:
      return 'OTHER';
    case TripClosureIncidentType.Completed:
    default:
      return 'UNSAFE_DRIVING';
  }
}

export function buildRatingOpportunities(
  membershipId: string | undefined,
  myRequests: TripRequestRecord[],
  incomingRequests: TripRequestRecord[],
): RatingParticipationOpportunity[] {
  if (!membershipId) {
    return [];
  }

  const items = new Map<string, RatingParticipationOpportunity>();

  const registerOpportunity = (opportunity: RatingParticipationOpportunity) => {
    if (!items.has(opportunity.id)) {
      items.set(opportunity.id, opportunity);
    }
  };

  myRequests.forEach((request) => {
    const closureSummary = getTripPostClosureSummary({
      status: request.tripStatus,
      departureAt: request.tripDepartureAt,
      estimatedArrivalAt: request.tripEstimatedArrivalAt,
      completedAt: request.tripCompletedAt,
      cancelledAt: request.tripCancelledAt,
    });

    if (
      request.status !== TripRequestStatus.Accepted ||
      !closureSummary.canCreateRating ||
      !closureSummary.actionWindowClosesAt ||
      !canCreateTripRating({
        status: request.tripStatus,
        departureAt: request.tripDepartureAt,
        estimatedArrivalAt: request.tripEstimatedArrivalAt,
        completedAt: request.tripCompletedAt,
      })
    ) {
      return;
    }

    registerOpportunity({
      id: `${request.tripId}:${request.driverMembershipId}`,
      tripId: request.tripId,
      targetMembershipId: request.driverMembershipId,
      targetFullName: request.driverFullName,
      tripOriginLabel: request.tripOriginLabel,
      tripDestinationLabel: request.tripDestinationLabel,
      tripDepartureAt: request.tripDepartureAt,
      ratingDirectionLabel: 'Calificar al conductor',
      windowClosesAt: closureSummary.actionWindowClosesAt.toISOString(),
    });
  });

  incomingRequests.forEach((request) => {
    const closureSummary = getTripPostClosureSummary({
      status: request.tripStatus,
      departureAt: request.tripDepartureAt,
      estimatedArrivalAt: request.tripEstimatedArrivalAt,
      completedAt: request.tripCompletedAt,
      cancelledAt: request.tripCancelledAt,
    });

    if (
      request.driverMembershipId !== membershipId ||
      request.status !== TripRequestStatus.Accepted ||
      !closureSummary.canCreateRating ||
      !closureSummary.actionWindowClosesAt ||
      !canCreateTripRating({
        status: request.tripStatus,
        departureAt: request.tripDepartureAt,
        estimatedArrivalAt: request.tripEstimatedArrivalAt,
        completedAt: request.tripCompletedAt,
      })
    ) {
      return;
    }

    registerOpportunity({
      id: `${request.tripId}:${request.passengerMembershipId}`,
      tripId: request.tripId,
      targetMembershipId: request.passengerMembershipId,
      targetFullName: request.passengerFullName,
      tripOriginLabel: request.tripOriginLabel,
      tripDestinationLabel: request.tripDestinationLabel,
      tripDepartureAt: request.tripDepartureAt,
      ratingDirectionLabel: 'Calificar al pasajero',
      windowClosesAt: closureSummary.actionWindowClosesAt.toISOString(),
    });
  });

  return sortByDepartureDateDescending(Array.from(items.values()));
}

export function buildReportOpportunities(
  membershipId: string | undefined,
  myRequests: TripRequestRecord[],
  incomingRequests: TripRequestRecord[],
): ReportParticipationOpportunity[] {
  if (!membershipId) {
    return [];
  }

  const items = new Map<string, ReportParticipationOpportunity>();

  const registerOpportunity = (opportunity: ReportParticipationOpportunity) => {
    if (!items.has(opportunity.id)) {
      items.set(opportunity.id, opportunity);
    }
  };

  myRequests.forEach((request) => {
    if (!wasConfirmedBeforeClosure(request)) {
      return;
    }

    const closureSummary = getTripPostClosureSummary({
      status: request.tripStatus,
      departureAt: request.tripDepartureAt,
      estimatedArrivalAt: request.tripEstimatedArrivalAt,
      completedAt: request.tripCompletedAt,
      cancelledAt: request.tripCancelledAt,
    });

    if (
      !closureSummary.canCreateIncidentReport ||
      !closureSummary.incidentType ||
      !closureSummary.actionWindowClosesAt
    ) {
      return;
    }

    registerOpportunity({
      id: `${request.tripId}:${request.driverMembershipId}`,
      tripId: request.tripId,
      targetMembershipId: request.driverMembershipId,
      targetFullName: request.driverFullName,
      tripOriginLabel: request.tripOriginLabel,
      tripDestinationLabel: request.tripDestinationLabel,
      tripDepartureAt: request.tripDepartureAt,
      reportDirectionLabel: 'Reportar al conductor',
      incidentType: closureSummary.incidentType,
      incidentLabel: getTripClosureIncidentLabel(closureSummary.incidentType),
      incidentTone: getTripClosureIncidentTone(closureSummary.incidentType),
      incidentSummary: getIncidentSummary(closureSummary.incidentType),
      suggestedReason: getSuggestedReportReason(closureSummary.incidentType),
      tripClosureNote: request.tripClosureNote,
      windowClosesAt: closureSummary.actionWindowClosesAt.toISOString(),
    });
  });

  incomingRequests.forEach((request) => {
    if (
      request.driverMembershipId !== membershipId ||
      request.status !== TripRequestStatus.Accepted
    ) {
      return;
    }

    const closureSummary = getTripPostClosureSummary({
      status: request.tripStatus,
      departureAt: request.tripDepartureAt,
      estimatedArrivalAt: request.tripEstimatedArrivalAt,
      completedAt: request.tripCompletedAt,
      cancelledAt: request.tripCancelledAt,
    });

    if (
      !closureSummary.canCreateIncidentReport ||
      !closureSummary.incidentType ||
      !closureSummary.actionWindowClosesAt ||
      closureSummary.incidentType === TripClosureIncidentType.DriverAbsence ||
      closureSummary.incidentType === TripClosureIncidentType.LateDriverCancellation
    ) {
      return;
    }

    registerOpportunity({
      id: `${request.tripId}:${request.passengerMembershipId}`,
      tripId: request.tripId,
      targetMembershipId: request.passengerMembershipId,
      targetFullName: request.passengerFullName,
      tripOriginLabel: request.tripOriginLabel,
      tripDestinationLabel: request.tripDestinationLabel,
      tripDepartureAt: request.tripDepartureAt,
      reportDirectionLabel: 'Reportar al pasajero',
      incidentType: closureSummary.incidentType,
      incidentLabel: getTripClosureIncidentLabel(closureSummary.incidentType),
      incidentTone: getTripClosureIncidentTone(closureSummary.incidentType),
      incidentSummary: getIncidentSummary(closureSummary.incidentType),
      suggestedReason: getSuggestedReportReason(closureSummary.incidentType),
      tripClosureNote: request.tripClosureNote,
      windowClosesAt: closureSummary.actionWindowClosesAt.toISOString(),
    });
  });

  return sortByDepartureDateDescending(Array.from(items.values()));
}

export function getInitialReportDraft(opportunity?: ReportParticipationOpportunity): ReportDraft {
  return {
    reason: opportunity?.suggestedReason ?? 'UNSAFE_DRIVING',
    description: '',
    evidenceFileKey: '',
    evidenceFileName: '',
    evidencePreviewUrl: null,
    evidenceMimeType: null,
  };
}

export function matchesClosureFocus(
  tripId: string,
  membershipId: string,
  focusedTripId: string | null,
  focusedMembershipId: string | null,
): boolean {
  if (!focusedTripId || focusedTripId !== tripId) {
    return false;
  }

  if (focusedMembershipId && focusedMembershipId !== membershipId) {
    return false;
  }

  return true;
}

export function buildClosureOpportunityElementId(
  kind: 'rating' | 'report',
  opportunityId: string,
): string {
  return `closure-focus-${kind}-${opportunityId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}
