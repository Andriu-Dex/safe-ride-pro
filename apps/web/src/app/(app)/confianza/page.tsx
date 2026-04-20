'use client';

import {
  canCreateTripRating,
  getTripPostClosureSummary,
  isOperationalMembership,
  OperationalSanctionType,
  selectOperationalMembership,
  TripRequestStatus,
  TripClosureIncidentType,
} from '@saferidepro/shared-types';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { OperationalAccessCard } from '../../../components/ui/operational-access-card';
import { StatusPill } from '../../../components/ui/status-pill';
import { TextareaField } from '../../../components/ui/textarea-field';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../modules/auth/lib/operational-context';
import { RatingOpportunityCard, type RatingOpportunity } from '../../../modules/ratings/components/rating-opportunity-card';
import { createRating, listMyRatings } from '../../../modules/ratings/lib/rating-api';
import { getRatingStars } from '../../../modules/ratings/lib/rating-labels';
import type { RatingList } from '../../../modules/ratings/types/rating';
import { ReportOpportunityCard, type ReportOpportunity } from '../../../modules/reports/components/report-opportunity-card';
import {
  createReport,
  listMyReports,
  uploadReportEvidence,
} from '../../../modules/reports/lib/report-api';
import {
  getReportReasonLabel,
  getReportSeverityLabel,
  getReportSeverityTone,
  getReportStatusLabel,
  getReportStatusTone,
} from '../../../modules/reports/lib/report-labels';
import type { ReportRecord } from '../../../modules/reports/types/report';
import { listIncomingTripRequests, listMyTripRequests } from '../../../modules/trip-requests/lib/trip-request-api';
import { wasConfirmedBeforeClosure } from '../../../modules/trip-requests/lib/trip-request-closure';
import type { TripRequestRecord } from '../../../modules/trip-requests/types/trip-request';
import {
  getTripClosureIncidentLabel,
  getTripClosureIncidentTone,
} from '../../../modules/trips/lib/trip-closure';
import { getCurrentUserTrustSummary } from '../../../modules/users/lib/user-api';
import {
  getAdministrativeRiskStateLabel,
  getAdministrativeRiskTone,
  getOperationalSanctionScopeLabel,
  getOperationalSanctionTone,
  getOperationalSanctionTypeLabel,
  getVisibleReputationStateLabel,
  getVisibleReputationTone,
} from '../../../modules/users/lib/trust-labels';
import type { TrustSummary } from '../../../modules/users/types/trust-summary';
import {
  listMySanctionAppeals,
  submitSanctionAppeal,
} from '../../../modules/sanctions/lib/sanction-api';
import {
  getSanctionAppealStatusLabel,
  getSanctionAppealStatusTone,
  SANCTION_APPEAL_REASON_MIN_LENGTH,
} from '../../../modules/sanctions/lib/sanction-labels';
import type { OperationalSanctionAppealRecord } from '../../../modules/sanctions/types/sanction';

type RatingDraft = {
  score: string;
  comment: string;
};

type ReportDraft = {
  reason: string;
  description: string;
  evidenceFileKey: string;
  evidenceFileName: string;
  evidencePreviewUrl: string | null;
  evidenceMimeType: string | null;
};

const EMPTY_RATING_DRAFT: RatingDraft = {
  score: '5',
  comment: '',
};

type RatingParticipationOpportunity = {
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

type ReportParticipationOpportunity = {
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
  windowClosesAt: string;
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

function formatAverageScore(score: number | null): string {
  return score === null ? 'Sin datos' : `${score.toFixed(1)}/5`;
}

function sortByDepartureDateDescending<T extends { tripDepartureAt: string }>(items: T[]): T[] {
  return items.sort(
    (left, right) =>
      new Date(right.tripDepartureAt).getTime() - new Date(left.tripDepartureAt).getTime(),
  );
}

function getIncidentSummary(incidentType: TripClosureIncidentType): string {
  switch (incidentType) {
    case TripClosureIncidentType.Completed:
      return 'Viaje completado dentro de la ventana de cierre. Si hubo un problema, registralo ahora.';
    case TripClosureIncidentType.LateDriverCancellation:
      return 'El conductor cancelo tarde un viaje que ya tenia participantes confirmados.';
    case TripClosureIncidentType.DriverAbsence:
      return 'El viaje fue cancelado por ausencia del conductor despues de la hora prevista de salida.';
    case TripClosureIncidentType.OverdueInProgress:
      return 'El viaje sigue abierto fuera del tiempo estimado y puede requerir cierre o revision administrativa.';
    default:
      return 'Incidente operativo disponible para revision.';
  }
}

function getSuggestedReportReason(incidentType: TripClosureIncidentType): string {
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

function buildRatingOpportunities(
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

function buildReportOpportunities(
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
      windowClosesAt: closureSummary.actionWindowClosesAt.toISOString(),
    });
  });

  return sortByDepartureDateDescending(Array.from(items.values()));
}

function getInitialReportDraft(opportunity?: ReportParticipationOpportunity): ReportDraft {
  return {
    reason: opportunity?.suggestedReason ?? 'UNSAFE_DRIVING',
    description: '',
    evidenceFileKey: '',
    evidenceFileName: '',
    evidencePreviewUrl: null,
    evidenceMimeType: null,
  };
}

function matchesClosureFocus(
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

function buildClosureOpportunityElementId(
  kind: 'rating' | 'report',
  opportunityId: string,
): string {
  return `closure-focus-${kind}-${opportunityId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export default function TrustPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const searchParams = useSearchParams();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [ratings, setRatings] = useState<RatingList>({ given: [], received: [] });
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [sanctionAppeals, setSanctionAppeals] = useState<OperationalSanctionAppealRecord[]>([]);
  const [myRequests, setMyRequests] = useState<TripRequestRecord[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<TripRequestRecord[]>([]);
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, RatingDraft>>({});
  const [reportDrafts, setReportDrafts] = useState<Record<string, ReportDraft>>({});
  const [sanctionAppealDrafts, setSanctionAppealDrafts] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isSubmittingRatingId, setIsSubmittingRatingId] = useState<string | null>(null);
  const [isSubmittingReportId, setIsSubmittingReportId] = useState<string | null>(null);
  const [isUploadingReportEvidenceId, setIsUploadingReportEvidenceId] = useState<string | null>(null);
  const [isSubmittingSanctionAppealId, setIsSubmittingSanctionAppealId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const reportDraftsRef = useRef(reportDrafts);

  const defaultMembership = selectOperationalMembership(authSession?.user.memberships);
  const defaultMembershipId =
    defaultMembership && isOperationalMembership(defaultMembership)
      ? defaultMembership.id
      : undefined;

  const loadData = async (accessToken: string) => {
    const [
      trustSummaryData,
      ratingsData,
      reportsData,
      appealsData,
      myTripRequests,
      incomingTripRequests,
    ] = await Promise.all([
      getCurrentUserTrustSummary(accessToken),
      listMyRatings(accessToken),
      listMyReports(accessToken),
      listMySanctionAppeals(accessToken),
      listMyTripRequests(accessToken),
      listIncomingTripRequests(accessToken),
    ]);

    setTrustSummary(trustSummaryData);
    setRatings(ratingsData);
    setReports(reportsData);
    setSanctionAppeals(appealsData);
    setMyRequests(myTripRequests);
    setIncomingRequests(incomingTripRequests);
  };

  const refreshData = async (showSpinner = false) => {
    if (!authSession) {
      return;
    }

    if (showSpinner) {
      setIsRefreshingData(true);
    }

    try {
      await loadData(authSession.accessToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible sincronizar calificaciones y reportes.'));
    } finally {
      if (showSpinner) {
        setIsRefreshingData(false);
      }
    }
  };

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession || !operationalAccess.hasOperationalMembership) {
      setTrustSummary(null);
      setRatings({ given: [], received: [] });
      setReports([]);
      setSanctionAppeals([]);
      setMyRequests([]);
      setIncomingRequests([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await loadData(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : 'No fue posible cargar calificaciones y reportes.',
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [authSession, isHydrated, operationalAccess.hasOperationalMembership]);

  useAutoRefresh(
    async () => {
      await refreshData();
    },
    {
      enabled: Boolean(authSession && isHydrated && operationalAccess.hasOperationalMembership),
      intervalMs: 20_000,
    },
  );

  useEffect(() => {
    reportDraftsRef.current = reportDrafts;
  }, [reportDrafts]);

  useEffect(() => {
    return () => {
      Object.values(reportDraftsRef.current).forEach((draft) => {
        if (draft.evidencePreviewUrl) {
          URL.revokeObjectURL(draft.evidencePreviewUrl);
        }
      });
    };
  }, []);

  const ratingOpportunities = useMemo(
    () => buildRatingOpportunities(defaultMembershipId, myRequests, incomingRequests),
    [defaultMembershipId, incomingRequests, myRequests],
  );
  const reportOpportunities = useMemo(
    () => buildReportOpportunities(defaultMembershipId, myRequests, incomingRequests),
    [defaultMembershipId, incomingRequests, myRequests],
  );

  const givenRatingKeys = useMemo(
    () =>
      new Set(
        ratings.given.map((rating) => `${rating.tripId}:${rating.targetMembershipId}`),
      ),
    [ratings.given],
  );
  const reportedKeys = useMemo(
    () =>
      new Set(
        reports.map((report) => `${report.tripId}:${report.reportedMembershipId}`),
      ),
    [reports],
  );
  const sanctionAppealsBySanctionId = useMemo(
    () =>
      new Map(
        sanctionAppeals.map((appeal) => [appeal.sanctionId, appeal] as const),
      ),
    [sanctionAppeals],
  );

  const pendingRatingOpportunities = ratingOpportunities.filter(
    (opportunity) => !givenRatingKeys.has(opportunity.id),
  );
  const pendingReportOpportunities = reportOpportunities.filter(
    (opportunity) => !reportedKeys.has(opportunity.id),
  );
  const totalPendingActions = pendingRatingOpportunities.length + pendingReportOpportunities.length;
  const activeSanctionsCount = trustSummary?.activeSanctions?.length ?? 0;
  const riskSignalsCount = trustSummary?.riskSignals.length ?? 0;
  const recentOperationalRiskCount =
    (trustSummary?.latePassengerTripRequestCancellations ?? 0) +
    (trustSummary?.passengerNoShows ?? 0);
  const focusedKind = searchParams.get('focus');
  const focusedTripId = searchParams.get('tripId');
  const focusedMembershipId = searchParams.get('membershipId');
  const highlightedRatingOpportunityIds = useMemo(
    () =>
      new Set(
        pendingRatingOpportunities
          .filter((opportunity) =>
            matchesClosureFocus(opportunity.tripId, opportunity.targetMembershipId, focusedTripId, focusedMembershipId),
          )
          .map((opportunity) => opportunity.id),
      ),
    [focusedMembershipId, focusedTripId, pendingRatingOpportunities],
  );
  const highlightedReportOpportunityIds = useMemo(
    () =>
      new Set(
        pendingReportOpportunities
          .filter((opportunity) =>
            matchesClosureFocus(
              opportunity.tripId,
              opportunity.targetMembershipId,
              focusedTripId,
              focusedMembershipId,
            ),
          )
          .map((opportunity) => opportunity.id),
      ),
    [focusedMembershipId, focusedTripId, pendingReportOpportunities],
  );

  useEffect(() => {
    if (!focusedTripId || (focusedKind !== 'rating' && focusedKind !== 'report')) {
      return;
    }

    const highlightedIds = focusedKind === 'rating'
      ? Array.from(highlightedRatingOpportunityIds)
      : Array.from(highlightedReportOpportunityIds);

    if (!highlightedIds.length) {
      return;
    }

    const targetElement = document.getElementById(
      buildClosureOpportunityElementId(focusedKind, highlightedIds[0]),
    );

    if (!targetElement) {
      return;
    }

    window.setTimeout(() => {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);
  }, [
    focusedKind,
    focusedTripId,
    highlightedRatingOpportunityIds,
    highlightedReportOpportunityIds,
  ]);

  const handleRatingDraftChange = (
    opportunityId: string,
    field: keyof RatingDraft,
    value: string,
  ) => {
    setRatingDrafts((currentDrafts) => ({
      ...currentDrafts,
      [opportunityId]: {
        ...(currentDrafts[opportunityId] ?? EMPTY_RATING_DRAFT),
        [field]: value,
      },
    }));
  };

  const handleReportDraftChange = (
    opportunity: ReportParticipationOpportunity,
    opportunityId: string,
    field: 'reason' | 'description',
    value: string,
  ) => {
    setReportDrafts((currentDrafts) => ({
      ...currentDrafts,
      [opportunityId]: {
        ...(currentDrafts[opportunityId] ?? getInitialReportDraft(opportunity)),
        [field]: value,
      },
    }));
  };

  const handleReportEvidenceValidationError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage(null);
  };

  const handleUploadReportEvidence = async (
    opportunity: ReportParticipationOpportunity,
    opportunityId: string,
    file: File,
  ) => {
    if (!authSession) {
      return;
    }

    setIsUploadingReportEvidenceId(opportunityId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await uploadReportEvidence(authSession.accessToken, file);
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

      setReportDrafts((currentDrafts) => {
        const currentDraft = currentDrafts[opportunityId] ?? getInitialReportDraft(opportunity);

        if (currentDraft.evidencePreviewUrl) {
          URL.revokeObjectURL(currentDraft.evidencePreviewUrl);
        }

        return {
          ...currentDrafts,
          [opportunityId]: {
            ...currentDraft,
            evidenceFileKey: response.fileKey,
            evidenceFileName: file.name,
            evidencePreviewUrl: previewUrl,
            evidenceMimeType: file.type || null,
          },
        };
      });

      setSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible cargar la evidencia del reporte.'),
      );
    } finally {
      setIsUploadingReportEvidenceId(null);
    }
  };

  const handleSanctionAppealDraftChange = (sanctionId: string, value: string) => {
    setSanctionAppealDrafts((currentDrafts) => ({
      ...currentDrafts,
      [sanctionId]: value,
    }));
  };

  const handleCreateRating = async (opportunity: RatingParticipationOpportunity) => {
    if (!authSession) {
      return;
    }

    const draft = ratingDrafts[opportunity.id] ?? EMPTY_RATING_DRAFT;
    setIsSubmittingRatingId(opportunity.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await createRating(authSession.accessToken, {
        tripId: opportunity.tripId,
        targetMembershipId: opportunity.targetMembershipId,
        score: Number.parseInt(draft.score, 10),
        comment: draft.comment || undefined,
      });

      await loadData(authSession.accessToken);
      setSuccessMessage(response.message);
      setRatingDrafts((currentDrafts) => ({
        ...currentDrafts,
        [opportunity.id]: EMPTY_RATING_DRAFT,
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible registrar la calificacion.'));
      await refreshData();
    } finally {
      setIsSubmittingRatingId(null);
    }
  };

  const handleCreateReport = async (opportunity: ReportParticipationOpportunity) => {
    if (!authSession) {
      return;
    }

    const draft = reportDrafts[opportunity.id] ?? getInitialReportDraft(opportunity);
    setIsSubmittingReportId(opportunity.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await createReport(authSession.accessToken, {
        tripId: opportunity.tripId,
        reportedMembershipId: opportunity.targetMembershipId,
        reason: draft.reason,
        description: draft.description || undefined,
        evidenceFileKey: draft.evidenceFileKey || undefined,
      });

      await loadData(authSession.accessToken);
      setSuccessMessage(response.message);
      setReportDrafts((currentDrafts) => {
        const currentDraft = currentDrafts[opportunity.id] ?? getInitialReportDraft(opportunity);

        if (currentDraft.evidencePreviewUrl) {
          URL.revokeObjectURL(currentDraft.evidencePreviewUrl);
        }

        return {
          ...currentDrafts,
          [opportunity.id]: getInitialReportDraft(opportunity),
        };
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible registrar el reporte.'));
      await refreshData();
    } finally {
      setIsSubmittingReportId(null);
    }
  };

  const handleSubmitSanctionAppeal = async (sanctionId: string) => {
    if (!authSession) {
      return;
    }

    const reason = sanctionAppealDrafts[sanctionId]?.trim() ?? '';
    setIsSubmittingSanctionAppealId(sanctionId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await submitSanctionAppeal(authSession.accessToken, sanctionId, {
        reason,
      });

      await loadData(authSession.accessToken);
      setSuccessMessage(response.message);
      setSanctionAppealDrafts((currentDrafts) => ({
        ...currentDrafts,
        [sanctionId]: '',
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible enviar la apelacion.'));
      await refreshData();
    } finally {
      setIsSubmittingSanctionAppealId(null);
    }
  };

  if (isLoading) {
    return (
      <section className="loading-state compact-loading-state">
        <div className="loading-card">
          <div aria-hidden="true" className="loading-pulse" />
          <h1 className="panel-title">Cargando confianza y seguridad</h1>
          <p className="panel-text">
            Estamos preparando tu historial de calificaciones y reportes del sistema.
          </p>
        </div>
      </section>
    );
  }

  if (!operationalAccess.hasOperationalMembership && operationalAccess.title && operationalAccess.message) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="topbar-title">Confianza</h1>
            <p className="topbar-subtitle">
              Revisa tu reputacion, califica interacciones cerradas y registra incidentes de cierre operativo.
            </p>
          </div>
          <StatusPill label="Operacion bloqueada" tone="warning" />
        </header>

        <section className="empty-state">
          <OperationalAccessCard
            message={operationalAccess.message}
            title={operationalAccess.title}
          />
        </section>
      </>
    );
  }

  return (
    <section className="trust-shell">
      <header className="trust-command">
        <div className="trust-command-copy">
          <p className="section-label">Confianza</p>
          <h1 className="trust-command-title">Reputacion y cierre operativo</h1>
          <p className="trust-command-subtitle">
            Controla tus pendientes de calificacion, reportes y estado administrativo desde un solo lugar.
          </p>
        </div>
        <div className="trust-command-actions">
          <Button
            disabled={isRefreshingData}
            onClick={() => void refreshData(true)}
            variant="secondary"
          >
            {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
          </Button>
          <StatusPill
            label={`${totalPendingActions} acciones pendientes`}
            tone={totalPendingActions ? 'warning' : 'success'}
          />
          {trustSummary ? (
            <StatusPill
              label={getVisibleReputationStateLabel(trustSummary.visibleReputationState)}
              tone={getVisibleReputationTone(trustSummary.visibleReputationState)}
            />
          ) : null}
          {trustSummary ? (
            <StatusPill
              label={getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)}
              tone={getAdministrativeRiskTone(trustSummary.administrativeRiskState)}
            />
          ) : null}
        </div>
      </header>

      {focusedKind && focusedTripId ? (
        <article className="trust-focus-banner">
          <div>
            <strong>{focusedKind === 'rating' ? 'Accion de calificacion abierta' : 'Accion de reporte abierta'}</strong>
            <p>
              Llegaste aqui desde el cierre post-viaje. La tarjeta correspondiente de este viaje se resaltara mas abajo.
            </p>
          </div>
          <StatusPill
            label={focusedKind === 'rating' ? 'Calificacion' : 'Reporte'}
            tone={focusedKind === 'rating' ? 'success' : 'warning'}
          />
        </article>
      ) : null}

      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
      {successMessage ? <div className="form-success">{successMessage}</div> : null}

      <section className="trust-kpi-grid">
        <TrustKpiCard
          label="Pendientes"
          note="Acciones de cierre activas"
          tone={totalPendingActions ? 'warning' : 'success'}
          value={`${totalPendingActions}`}
        />
        <TrustKpiCard
          label="Promedio"
          note="Calificacion recibida"
          tone="neutral"
          value={formatAverageScore(trustSummary?.averageRatingReceived ?? null)}
        />
        <TrustKpiCard
          label="Interacciones"
          note="Trayectos cerrados"
          tone="neutral"
          value={`${trustSummary?.completedInteractions ?? 0}`}
        />
        <TrustKpiCard
          label="Restricciones"
          note="Vigentes ahora"
          tone={activeSanctionsCount ? 'warning' : 'success'}
          value={`${activeSanctionsCount}`}
        />
      </section>

      <section className="trust-main-grid">
        {trustSummary ? (
          <article className="trust-summary-card">
            <div className="trust-summary-head">
              <div>
                <p className="section-label">Resumen</p>
                <h2 className="panel-title">Estado reputacional</h2>
              </div>
              <div className="button-row">
                <StatusPill
                  label={getVisibleReputationStateLabel(trustSummary.visibleReputationState)}
                  tone={getVisibleReputationTone(trustSummary.visibleReputationState)}
                />
                <StatusPill
                  label={getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)}
                  tone={getAdministrativeRiskTone(trustSummary.administrativeRiskState)}
                />
              </div>
            </div>

            <div className="trust-mini-metric-grid">
              <TrustMiniMetric
                label="Calificaciones"
                value={`${trustSummary.totalRatingsReceived}`}
              />
              <TrustMiniMetric
                label="Riesgos"
                value={`${riskSignalsCount}`}
              />
              <TrustMiniMetric
                label="Reportes graves"
                value={`${trustSummary.resolvedHighSeverityReportsReceived}`}
              />
              <TrustMiniMetric
                label="Apelaciones"
                value={`${sanctionAppeals.length}`}
              />
            </div>

            <div className="trust-signal-card">
              <div className="list-card-header">
                <strong>Senales actuales</strong>
                <span className="section-heading-meta">{riskSignalsCount} detectadas</span>
              </div>
              {trustSummary.riskSignals.length ? (
                <ul className="trust-signal-list">
                  {trustSummary.riskSignals.map((signal) => (
                    <li key={signal} className="trust-signal-item">
                      {signal}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-text">
                  No se detectaron observaciones recientes en tu membresia activa.
                </p>
              )}
            </div>
          </article>
        ) : null}

        {trustSummary ? (
          <article className="trust-summary-card trust-summary-card-muted">
            <div className="trust-summary-head">
              <div>
                <p className="section-label">Marco operativo</p>
                <h2 className="panel-title">Politicas vigentes</h2>
              </div>
            </div>

            <div className="trust-policy-grid">
              <TrustPolicyCard
                label="Cancelacion tardia"
                value={`${trustSummary.cancellationPolicy.lateWindowMinutes} min`}
              />
              <TrustPolicyCard
                label="Rating bajo"
                value={`${trustSummary.reputationPolicy.lowRatingThreshold.toFixed(1)}/5`}
              />
              <TrustPolicyCard
                label="Minimo de ratings"
                value={`${trustSummary.reputationPolicy.minimumRatingsForSignal}`}
              />
              <TrustPolicyCard
                label="Interacciones minimas"
                value={`${trustSummary.reputationPolicy.minimumCompletedInteractionsForSignal}`}
              />
              <TrustPolicyCard
                label="Reincidencia"
                value={`${trustSummary.reputationPolicy.recurrenceWindowDays} dias`}
              />
              <TrustPolicyCard
                label="Ventana de reportes"
                value={
                  trustSummary.sanctionPolicy
                    ? `${trustSummary.sanctionPolicy.reportsWindowDays} dias`
                    : 'No definida'
                }
              />
            </div>

            <div className="trust-mini-metric-grid">
              <TrustMiniMetric
                label="Como conductor"
                value={`${trustSummary.completedTripsAsDriver}`}
              />
              <TrustMiniMetric
                label="Como pasajero"
                value={`${trustSummary.completedTripsAsPassenger}`}
              />
              <TrustMiniMetric
                label="Cancelaciones tardias"
                value={`${trustSummary.lateDriverTripCancellations}`}
              />
              <TrustMiniMetric
                label="No-show y cancelaciones"
                value={`${recentOperationalRiskCount}`}
              />
            </div>
          </article>
        ) : null}
      </section>

      <section className="trust-section-block">
        <div className="section-heading">
          <div>
            <h2 className="panel-title">Bandeja de cierre</h2>
            <p className="section-heading-meta">
              {pendingRatingOpportunities.length} calificaciones y {pendingReportOpportunities.length} reportes pendientes
            </p>
          </div>
        </div>

        <div className="page-grid page-grid-wide">
          <article className="panel panel-stack">
            <div className="section-heading">
              <h3 className="panel-title">Calificaciones pendientes</h3>
              <p className="section-heading-meta">{pendingRatingOpportunities.length} disponibles</p>
            </div>
            {pendingRatingOpportunities.length ? (
              <div className="list-stack">
                {pendingRatingOpportunities.map((opportunity) => (
                  <RatingOpportunityCard
                    elementId={buildClosureOpportunityElementId('rating', opportunity.id)}
                    highlighted={highlightedRatingOpportunityIds.has(opportunity.id)}
                    key={opportunity.id}
                    isSubmitting={isSubmittingRatingId === opportunity.id}
                    onChange={(field, value) => handleRatingDraftChange(opportunity.id, field, value)}
                    onSubmit={() => void handleCreateRating(opportunity)}
                    opportunity={{
                      id: opportunity.id,
                      tripId: opportunity.tripId,
                      targetMembershipId: opportunity.targetMembershipId,
                      targetFullName: opportunity.targetFullName,
                      tripOriginLabel: opportunity.tripOriginLabel,
                      tripDestinationLabel: opportunity.tripDestinationLabel,
                      tripDepartureAt: opportunity.tripDepartureAt,
                      directionLabel: opportunity.ratingDirectionLabel,
                      windowClosesAt: opportunity.windowClosesAt,
                    } satisfies RatingOpportunity}
                    value={ratingDrafts[opportunity.id] ?? EMPTY_RATING_DRAFT}
                  />
                ))}
              </div>
            ) : (
              <TrustEmptyStateCopy message="No tienes calificaciones pendientes. Tu historial esta al dia con los viajes cerrados actuales." />
            )}
          </article>

          <article className="panel panel-stack">
            <div className="section-heading">
              <h3 className="panel-title">Reportes pendientes</h3>
              <p className="section-heading-meta">{pendingReportOpportunities.length} disponibles</p>
            </div>
            {pendingReportOpportunities.length ? (
              <div className="list-stack">
                {pendingReportOpportunities.map((opportunity) => (
                  <ReportOpportunityCard
                    elementId={buildClosureOpportunityElementId('report', opportunity.id)}
                    highlighted={highlightedReportOpportunityIds.has(opportunity.id)}
                    key={opportunity.id}
                    isSubmitting={isSubmittingReportId === opportunity.id}
                    isUploadingEvidence={isUploadingReportEvidenceId === opportunity.id}
                    onChange={(field, value) =>
                      handleReportDraftChange(opportunity, opportunity.id, field, value)
                    }
                    onEvidenceValidationError={handleReportEvidenceValidationError}
                    onUploadEvidence={(file) =>
                      void handleUploadReportEvidence(opportunity, opportunity.id, file)
                    }
                    onSubmit={() => void handleCreateReport(opportunity)}
                    opportunity={{
                      id: opportunity.id,
                      tripId: opportunity.tripId,
                      reportedMembershipId: opportunity.targetMembershipId,
                      reportedFullName: opportunity.targetFullName,
                      tripOriginLabel: opportunity.tripOriginLabel,
                      tripDestinationLabel: opportunity.tripDestinationLabel,
                      tripDepartureAt: opportunity.tripDepartureAt,
                      directionLabel: opportunity.reportDirectionLabel,
                      incidentLabel: opportunity.incidentLabel,
                      incidentTone: opportunity.incidentTone,
                      incidentSummary: opportunity.incidentSummary,
                      windowClosesAt: opportunity.windowClosesAt,
                    } satisfies ReportOpportunity}
                    value={reportDrafts[opportunity.id] ?? getInitialReportDraft(opportunity)}
                  />
                ))}
              </div>
            ) : (
              <TrustEmptyStateCopy message="No tienes reportes pendientes. No se detectan cierres anomalos o incidentes disponibles para registrar." />
            )}
          </article>
        </div>
      </section>

        {trustSummary?.activeSanctions?.length ? (
          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Restricciones activas</h2>
              <p className="section-heading-meta">
                {trustSummary.activeSanctions.length} vigentes
              </p>
            </div>
            <div className="list-stack">
              {trustSummary.activeSanctions.map((sanction) => {
                const linkedAppeal = sanctionAppealsBySanctionId.get(sanction.id);
                const canAppeal = sanction.type !== OperationalSanctionType.Warning;
                const appealDraft = sanctionAppealDrafts[sanction.id] ?? '';

                return (
                  <div key={sanction.id} className="list-card list-card-strong">
                    <div className="list-card-header">
                      <strong>{getOperationalSanctionTypeLabel(sanction.type)}</strong>
                      <div className="button-row">
                        <StatusPill
                          label={getOperationalSanctionScopeLabel(sanction.scope)}
                          tone={getOperationalSanctionTone(sanction.type)}
                        />
                        {linkedAppeal ? (
                          <StatusPill
                            label={getSanctionAppealStatusLabel(linkedAppeal.status)}
                            tone={getSanctionAppealStatusTone(linkedAppeal.status)}
                          />
                        ) : null}
                      </div>
                    </div>
                    <p className="panel-text">{sanction.reason}</p>
                    <p className="panel-text">
                      Inicio: {formatDateTime(sanction.startedAt)}
                      {sanction.endsAt ? ` | Fin estimado: ${formatDateTime(sanction.endsAt)}` : ''}
                    </p>

                    {linkedAppeal ? (
                      <>
                        <p className="panel-text">Apelacion: {linkedAppeal.reason}</p>
                        <p className="panel-text">
                          Estado actual: {getSanctionAppealStatusLabel(linkedAppeal.status)}
                        </p>
                        {linkedAppeal.reviewNote ? (
                          <p className="panel-text">
                            Revision administrativa: {linkedAppeal.reviewNote}
                          </p>
                        ) : null}
                      </>
                    ) : canAppeal ? (
                      <>
                        <TextareaField
                          label="Motivo de apelacion"
                          onChange={(event) =>
                            handleSanctionAppealDraftChange(sanction.id, event.target.value)
                          }
                          placeholder="Explica por que consideras que la restriccion debe revisarse"
                          rows={3}
                          value={appealDraft}
                        />
                        <p className="form-helper">
                          La apelacion debe tener al menos {SANCTION_APPEAL_REASON_MIN_LENGTH} caracteres.
                        </p>
                        <div className="button-row">
                          <Button
                            disabled={
                              isSubmittingSanctionAppealId === sanction.id ||
                              appealDraft.trim().length < SANCTION_APPEAL_REASON_MIN_LENGTH
                            }
                            onClick={() => void handleSubmitSanctionAppeal(sanction.id)}
                          >
                            {isSubmittingSanctionAppealId === sanction.id
                              ? 'Enviando apelacion...'
                              : 'Enviar apelacion'}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="panel-text">
                        Las advertencias activas no requieren apelacion administrativa en esta fase.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ) : null}

        {sanctionAppeals.length ? (
          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Historial de apelaciones</h2>
              <p className="section-heading-meta">{sanctionAppeals.length} registradas</p>
            </div>
            <div className="list-stack">
              {sanctionAppeals.map((appeal) => (
                <div key={appeal.id} className="list-card">
                  <div className="list-card-header">
                    <strong>{getOperationalSanctionTypeLabel(appeal.sanctionType)}</strong>
                    <StatusPill
                      label={getSanctionAppealStatusLabel(appeal.status)}
                      tone={getSanctionAppealStatusTone(appeal.status)}
                    />
                  </div>
                  <p className="panel-text">
                    Alcance: {getOperationalSanctionScopeLabel(appeal.sanctionScope)} | Inicio de sancion: {formatDateTime(appeal.sanctionStartedAt)}
                  </p>
                  <p className="panel-text">Motivo de apelacion: {appeal.reason}</p>
                  <p className="panel-text">Registrada: {formatDateTime(appeal.createdAt)}</p>
                  {appeal.reviewNote ? (
                    <p className="panel-text">Revision administrativa: {appeal.reviewNote}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        ) : null}

      <section className="trust-history-grid">
          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Calificaciones emitidas</h2>
              <p className="section-heading-meta">{ratings.given.length} registradas</p>
            </div>
            {ratings.given.length ? (
              <div className="list-stack">
                {ratings.given.map((rating) => (
                  <div key={rating.id} className="list-card">
                    <div className="list-card-header">
                      <strong>{rating.targetFullName}</strong>
                      <span className="stars-inline">{getRatingStars(rating.score)} {rating.score}/5</span>
                    </div>
                    <p className="panel-text">
                      Viaje: {rating.tripOriginLabel} -&gt; {rating.tripDestinationLabel}
                    </p>
                    <p className="panel-text">Salida: {formatDateTime(rating.tripDepartureAt)}</p>
                    {rating.comment ? <p className="panel-text">Comentario: {rating.comment}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-text">Todavia no has emitido calificaciones.</p>
            )}
          </article>

          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Calificaciones recibidas</h2>
              <p className="section-heading-meta">{ratings.received.length} registradas</p>
            </div>
            {ratings.received.length ? (
              <div className="list-stack">
                {ratings.received.map((rating) => (
                  <div key={rating.id} className="list-card">
                    <div className="list-card-header">
                      <strong>{rating.authorFullName}</strong>
                      <span className="stars-inline">{getRatingStars(rating.score)} {rating.score}/5</span>
                    </div>
                    <p className="panel-text">
                      Viaje: {rating.tripOriginLabel} -&gt; {rating.tripDestinationLabel}
                    </p>
                    <p className="panel-text">Salida: {formatDateTime(rating.tripDepartureAt)}</p>
                    {rating.comment ? <p className="panel-text">Comentario: {rating.comment}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-text">Aun no has recibido calificaciones en la membresia activa.</p>
            )}
          </article>
      </section>

        <article className="panel panel-stack">
          <div className="section-heading">
            <h2 className="panel-title">Mis reportes</h2>
            <p className="section-heading-meta">{reports.length} registrados</p>
          </div>
          {reports.length ? (
            <div className="list-stack">
              {reports.map((report) => (
                <div key={report.id} className="list-card">
                  <div className="list-card-header">
                    <strong>{report.reportedFullName}</strong>
                    <StatusPill
                      label={getReportStatusLabel(report.status)}
                      tone={getReportStatusTone(report.status)}
                    />
                  </div>
                  <p className="panel-text">
                    Viaje: {report.tripOriginLabel} -&gt; {report.tripDestinationLabel}
                  </p>
                  <p className="panel-text">Motivo: {getReportReasonLabel(report.reason)}</p>
                  <div className="button-row">
                    <StatusPill
                      label={getReportSeverityLabel(report.reason)}
                      tone={getReportSeverityTone(report.reason)}
                    />
                  </div>
                  <p className="panel-text">Registrado: {formatDateTime(report.createdAt)}</p>
                  {report.description ? (
                    <p className="panel-text">Descripcion: {report.description}</p>
                  ) : null}
                  {report.reviewNote ? (
                    <p className="panel-text">Revision administrativa: {report.reviewNote}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-text">Aun no has enviado reportes desde esta membresia.</p>
          )}
        </article>

      {trustSummary ? (
        <div className="form-helper trust-footnote">
          Cancelacion tardia: {trustSummary.cancellationPolicy.lateWindowMinutes} minutos antes de la salida.
          Ultimo calculo: {formatDateTime(trustSummary.cancellationPolicy.lastComputedAt)}.
          {' '}
          Rating bajo: {trustSummary.reputationPolicy.lowRatingThreshold.toFixed(1)}/5.
          {' '}
          Reincidencia: {trustSummary.reputationPolicy.recurrenceWindowDays} dias.
          {trustSummary.sanctionPolicy
            ? ` Ventanas administrativas: ${trustSummary.sanctionPolicy.operationalWindowDays} dias operativos y ${trustSummary.sanctionPolicy.reportsWindowDays} dias para reportes.`
            : ''}
        </div>
      ) : null}
    </section>
  );
}

function TrustKpiCard({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  note: string;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return (
    <article className={`trust-kpi-card trust-kpi-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

function TrustMiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="trust-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrustPolicyCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="trust-policy-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrustEmptyStateCopy({ message }: { message: string }) {
  return <p className="panel-text">{message}</p>;
}
