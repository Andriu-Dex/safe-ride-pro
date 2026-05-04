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
import { ToastStack, type ToastItem } from '../../../components/ui/toast-stack';
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
import styles from './page.module.css';

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
  tripClosureNote: string | null;
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

function getIncidentSummary(
  incidentType: TripClosureIncidentType,
  tripClosureNote: string | null = null,
): string {
  const closureContext = tripClosureNote?.trim()
    ? ` Cierre operativo registrado: ${tripClosureNote.trim()}`
    : '';

  switch (incidentType) {
    case TripClosureIncidentType.Completed:
      return `Viaje completado dentro de la ventana de cierre. Si hubo un problema, registralo ahora.${closureContext}`;
    case TripClosureIncidentType.LateDriverCancellation:
      return `El conductor cancelo tarde un viaje que ya tenia participantes confirmados.${closureContext}`;
    case TripClosureIncidentType.DriverAbsence:
      return `El viaje fue cancelado por ausencia del conductor despues de la hora prevista de salida.${closureContext}`;
    case TripClosureIncidentType.OverdueInProgress:
      return `El viaje sigue abierto fuera del tiempo estimado y puede requerir cierre o revision administrativa.${closureContext}`;
    default:
      return `Incidente operativo disponible para revision.${closureContext}`;
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
      incidentSummary: getIncidentSummary(
        closureSummary.incidentType,
        request.tripClosureNote,
      ),
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
      incidentSummary: getIncidentSummary(
        closureSummary.incidentType,
        request.tripClosureNote,
      ),
      suggestedReason: getSuggestedReportReason(closureSummary.incidentType),
      tripClosureNote: request.tripClosureNote,
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
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const reportDraftsRef = useRef(reportDrafts);

  const pushToast = (
    title: string,
    description: string,
    tone: ToastItem['tone'] = 'info',
  ) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `trust-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  };

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
    if (!errorMessage) {
      return;
    }

    pushToast('No se pudo completar la accion', errorMessage, 'error');
    setErrorMessage(null);
  }, [errorMessage]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    pushToast('Accion completada', successMessage, 'success');
    setSuccessMessage(null);
  }, [successMessage]);

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
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.loadingShell}>
          <article className={styles.loadingCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.loadingTitle}>Cargando confianza</h1>
            <p className={styles.loadingText}>
              Estamos preparando tus calificaciones, reportes y restricciones.
            </p>
          </article>
        </section>
      </>
    );
  }

  if (!operationalAccess.hasOperationalMembership && operationalAccess.title && operationalAccess.message) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.lockedShell}>
          <article className={styles.lockedCard}>
            <div className={styles.lockedHeader}>
              <div>
                <p className={styles.kicker}>Confianza</p>
                <h1 className={styles.lockedTitle}>Operacion no disponible</h1>
              </div>
              <StatusPill label="Operacion bloqueada" tone="warning" />
            </div>
            <div className={styles.lockedBody}>
              <OperationalAccessCard
                message={operationalAccess.message}
                title={operationalAccess.title}
              />
            </div>
          </article>
        </section>
      </>
    );
  }

  return (
      <section className={styles.trustShell}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />

        <header className={`${styles.hero} ${styles.reveal}`}>
        <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Confianza</p>
              <h1 className={styles.heroTitle}>Reputacion y seguridad</h1>
              <p className={styles.heroLead}>
                Resuelve pendientes, revisa restricciones y conserva un historial claro.
              </p>
            </div>
          <div className={styles.heroActions}>
            <StatusPill
              label={`${totalPendingActions} pendientes`}
              tone={totalPendingActions ? 'warning' : 'success'}
            />
            {trustSummary ? (
              <StatusPill
                label={getVisibleReputationStateLabel(trustSummary.visibleReputationState)}
                tone={getVisibleReputationTone(trustSummary.visibleReputationState)}
              />
            ) : null}
            <Button
              disabled={isRefreshingData}
              onClick={() => void refreshData(true)}
              variant="secondary"
            >
              {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
        </div>
      </header>

      {focusedKind && focusedTripId ? (
          <article className={styles.focusBanner}>
            <div>
              <strong>{focusedKind === 'rating' ? 'Calificacion resaltada' : 'Reporte resaltado'}</strong>
              <p>La accion vinculada al cierre reciente esta marcada mas abajo.</p>
            </div>
            <StatusPill
              label={focusedKind === 'rating' ? 'Calificacion' : 'Reporte'}
            tone={focusedKind === 'rating' ? 'success' : 'warning'}
          />
        </article>
      ) : null}

      <div className={styles.board}>
        <main className={styles.primaryColumn}>
          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.sectionKicker}>Cierre</p>
                  <h2 className={styles.sectionTitle}>Pendientes</h2>
                </div>
                <StatusPill
                  label={`${pendingRatingOpportunities.length + pendingReportOpportunities.length} activos`}
                tone={totalPendingActions ? 'warning' : 'success'}
              />
            </div>

            <div className={styles.closureGrid}>
                <article className={styles.surfaceCard}>
                  <div className={styles.surfaceHeader}>
                    <div>
                      <h3 className={styles.surfaceTitle}>Calificaciones</h3>
                      <p className={styles.sectionMeta}>{pendingRatingOpportunities.length} por resolver</p>
                    </div>
                  </div>
                {pendingRatingOpportunities.length ? (
                  <div className={styles.stackList}>
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
                  <TrustEmptyStateCopy message="No tienes calificaciones pendientes." />
                )}
              </article>

                <article className={styles.surfaceCard}>
                  <div className={styles.surfaceHeader}>
                    <div>
                      <h3 className={styles.surfaceTitle}>Reportes</h3>
                      <p className={styles.sectionMeta}>{pendingReportOpportunities.length} por resolver</p>
                    </div>
                  </div>
                {pendingReportOpportunities.length ? (
                  <div className={styles.stackList}>
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
                          tripClosureNote: opportunity.tripClosureNote,
                          windowClosesAt: opportunity.windowClosesAt,
                        } satisfies ReportOpportunity}
                        value={reportDrafts[opportunity.id] ?? getInitialReportDraft(opportunity)}
                      />
                    ))}
                  </div>
                ) : (
                  <TrustEmptyStateCopy message="No tienes reportes pendientes." />
                )}
              </article>
            </div>
          </section>

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.sectionKicker}>Historial</p>
                  <h2 className={styles.sectionTitle}>Calificaciones</h2>
                </div>
              </div>

            <div className={styles.historyGrid}>
              <article className={styles.surfaceCard}>
                <div className={styles.surfaceHeader}>
                  <div>
                    <h3 className={styles.surfaceTitle}>Calificaciones emitidas</h3>
                    <p className={styles.sectionMeta}>{ratings.given.length} registradas</p>
                  </div>
                </div>
                {ratings.given.length ? (
                  <div className={styles.stackList}>
                    {ratings.given.map((rating) => (
                      <div key={rating.id} className={styles.recordCard}>
                        <div className={styles.recordHeader}>
                          <strong>{rating.targetFullName}</strong>
                          <span className={styles.inlineStars}>{getRatingStars(rating.score)} {rating.score}/5</span>
                        </div>
                        <p className={styles.noteText}>{rating.tripOriginLabel} -&gt; {rating.tripDestinationLabel}</p>
                        <p className={styles.noteText}>{formatDateTime(rating.tripDepartureAt)}</p>
                        {rating.comment ? <p className={styles.noteText}>{rating.comment}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <TrustEmptyStateCopy message="Todavia no has emitido calificaciones." />
                )}
              </article>

              <article className={styles.surfaceCard}>
                <div className={styles.surfaceHeader}>
                  <div>
                    <h3 className={styles.surfaceTitle}>Calificaciones recibidas</h3>
                    <p className={styles.sectionMeta}>{ratings.received.length} registradas</p>
                  </div>
                </div>
                {ratings.received.length ? (
                  <div className={styles.stackList}>
                    {ratings.received.map((rating) => (
                      <div key={rating.id} className={styles.recordCard}>
                        <div className={styles.recordHeader}>
                          <strong>{rating.authorFullName}</strong>
                          <span className={styles.inlineStars}>{getRatingStars(rating.score)} {rating.score}/5</span>
                        </div>
                        <p className={styles.noteText}>{rating.tripOriginLabel} -&gt; {rating.tripDestinationLabel}</p>
                        <p className={styles.noteText}>{formatDateTime(rating.tripDepartureAt)}</p>
                        {rating.comment ? <p className={styles.noteText}>{rating.comment}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <TrustEmptyStateCopy message="Aun no has recibido calificaciones en la membresia activa." />
                )}
              </article>
            </div>
          </section>

          <section className={styles.sectionBlock}>
            <div className={styles.sectionHeading}>
                <div>
                  <p className={styles.sectionKicker}>Reportes</p>
                  <h2 className={styles.sectionTitle}>Historial de reportes</h2>
                </div>
                <StatusPill label={`${reports.length} registrados`} tone="neutral" />
              </div>
            {reports.length ? (
              <div className={styles.stackList}>
                {reports.map((report) => (
                  <div key={report.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <strong>{report.reportedFullName}</strong>
                      <StatusPill
                        label={getReportStatusLabel(report.status)}
                        tone={getReportStatusTone(report.status)}
                      />
                    </div>
                    <p className={styles.noteText}>{report.tripOriginLabel} -&gt; {report.tripDestinationLabel}</p>
                    <div className={styles.badgeRow}>
                      <StatusPill
                        label={getReportSeverityLabel(report.reason)}
                        tone={getReportSeverityTone(report.reason)}
                      />
                    </div>
                    <p className={styles.noteText}>Motivo: {getReportReasonLabel(report.reason)}</p>
                    <p className={styles.noteText}>Registrado: {formatDateTime(report.createdAt)}</p>
                    {report.description ? <p className={styles.noteText}>{report.description}</p> : null}
                    {report.reviewNote ? <p className={styles.noteText}>Revision: {report.reviewNote}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <TrustEmptyStateCopy message="Aun no has enviado reportes desde esta membresia." />
            )}
          </section>
        </main>

        <aside className={styles.sideColumn}>
          {trustSummary ? (
            <article className={styles.surfaceCard}>
              <div className={styles.surfaceHeader}>
                <div>
                  <p className={styles.sectionKicker}>Resumen</p>
                  <h3 className={styles.surfaceTitle}>Estado</h3>
                </div>
                <div className={styles.badgeRow}>
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

              <div className={styles.miniGrid}>
                <TrustMiniMetric label="Promedio" value={formatAverageScore(trustSummary.averageRatingReceived ?? null)} />
                <TrustMiniMetric label="Ratings" value={`${trustSummary.totalRatingsReceived}`} />
                <TrustMiniMetric label="Interacciones" value={`${trustSummary.completedInteractions}`} />
                <TrustMiniMetric label="Riesgos" value={`${riskSignalsCount}`} />
                <TrustMiniMetric label="Restricciones" value={`${activeSanctionsCount}`} />
                <TrustMiniMetric label="Apelaciones" value={`${sanctionAppeals.length}`} />
              </div>

              <div className={styles.signalCard}>
                <div className={styles.recordHeader}>
                  <strong>Senales actuales</strong>
                  <span className={styles.noteText}>{riskSignalsCount} detectadas</span>
                </div>
                {trustSummary.riskSignals.length ? (
                  <ul className={styles.signalList}>
                    {trustSummary.riskSignals.map((signal) => (
                      <li key={signal}>{signal}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.noteText}>No se detectaron observaciones recientes.</p>
                )}
              </div>
            </article>
          ) : null}

          {trustSummary?.activeSanctions?.length ? (
            <article className={styles.surfaceCard}>
              <div className={styles.surfaceHeader}>
                <div>
                  <p className={styles.sectionKicker}>Restricciones</p>
                  <h3 className={styles.surfaceTitle}>Restricciones activas</h3>
                </div>
                <StatusPill label={`${trustSummary.activeSanctions.length} vigentes`} tone="warning" />
              </div>
              <div className={styles.stackList}>
                {trustSummary.activeSanctions.map((sanction) => {
                  const linkedAppeal = sanctionAppealsBySanctionId.get(sanction.id);
                  const canAppeal = sanction.type !== OperationalSanctionType.Warning;
                  const appealDraft = sanctionAppealDrafts[sanction.id] ?? '';

                  return (
                    <div key={sanction.id} className={styles.recordCard}>
                      <div className={styles.recordHeader}>
                        <strong>{getOperationalSanctionTypeLabel(sanction.type)}</strong>
                        <div className={styles.badgeRow}>
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
                      <p className={styles.noteText}>{sanction.reason}</p>
                      <p className={styles.noteText}>
                        Inicio: {formatDateTime(sanction.startedAt)}
                        {sanction.endsAt ? ` | Fin: ${formatDateTime(sanction.endsAt)}` : ''}
                      </p>

                      {linkedAppeal ? (
                        <>
                          <p className={styles.noteText}>Apelacion: {linkedAppeal.reason}</p>
                          {linkedAppeal.reviewNote ? (
                            <p className={styles.noteText}>Revision: {linkedAppeal.reviewNote}</p>
                          ) : null}
                        </>
                      ) : canAppeal ? (
                        <div className={styles.appealBlock}>
                          <TextareaField
                            label="Motivo de apelacion"
                            onChange={(event) =>
                              handleSanctionAppealDraftChange(sanction.id, event.target.value)
                            }
                            placeholder="Explica por que consideras que la restriccion debe revisarse"
                            rows={3}
                            value={appealDraft}
                          />
                          <p className={styles.helperText}>
                            Minimo {SANCTION_APPEAL_REASON_MIN_LENGTH} caracteres.
                          </p>
                          <div className={styles.actionRow}>
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
                        </div>
                      ) : (
                        <p className={styles.noteText}>Esta advertencia no requiere apelacion.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ) : null}

          {sanctionAppeals.length ? (
            <article className={styles.surfaceCard}>
              <div className={styles.surfaceHeader}>
                <div>
                  <p className={styles.sectionKicker}>Apelaciones</p>
                  <h3 className={styles.surfaceTitle}>Historial</h3>
                </div>
                <StatusPill label={`${sanctionAppeals.length} registradas`} tone="neutral" />
              </div>
              <div className={styles.stackList}>
                {sanctionAppeals.map((appeal) => (
                  <div key={appeal.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <strong>{getOperationalSanctionTypeLabel(appeal.sanctionType)}</strong>
                      <StatusPill
                        label={getSanctionAppealStatusLabel(appeal.status)}
                        tone={getSanctionAppealStatusTone(appeal.status)}
                      />
                    </div>
                    <p className={styles.noteText}>Motivo: {appeal.reason}</p>
                    <p className={styles.noteText}>Registrada: {formatDateTime(appeal.createdAt)}</p>
                    {appeal.reviewNote ? <p className={styles.noteText}>Revision: {appeal.reviewNote}</p> : null}
                  </div>
                ))}
              </div>
            </article>
          ) : null}

        </aside>
      </div>
    </section>
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
    <div className={styles.miniMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrustEmptyStateCopy({ message }: { message: string }) {
  return <p className={styles.emptyCopy}>{message}</p>;
}
