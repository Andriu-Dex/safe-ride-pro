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

function getBadgeClass(tone: string): string {
  switch (tone) {
    case 'success':
      return styles.heroBadgeSuccess;
    case 'warning':
      return styles.heroBadgeWarning;
    case 'danger':
      return styles.heroBadgeDanger;
    default:
      return styles.heroBadgeNeutral;
  }
}

function sortByDepartureDateDescending<T extends { tripDepartureAt: string }>(items: T[]): T[] {
  return items.sort(
    (left, right) =>
      new Date(right.tripDepartureAt).getTime() - new Date(left.tripDepartureAt).getTime(),
  );
}

function getIncidentSummary(
  incidentType: TripClosureIncidentType,
): string {
  switch (incidentType) {
    case TripClosureIncidentType.Completed:
      return `Viaje completado dentro de la ventana de cierre. Si hubo un problema, regístralo ahora.`;
    case TripClosureIncidentType.LateDriverCancellation:
      return `El conductor canceló tarde un viaje que ya tenía participantes confirmados.`;
    case TripClosureIncidentType.DriverAbsence:
      return `El viaje fue cancelado por ausencia del conductor después de la hora prevista de salida.`;
    case TripClosureIncidentType.OverdueInProgress:
      return `El viaje sigue abierto fuera del tiempo estimado y puede requerir cierre o revisión administrativa.`;
    default:
      return `Incidente operativo disponible para revisión.`;
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
  const [activeRatingOpportunity, setActiveRatingOpportunity] = useState<RatingParticipationOpportunity | null>(null);
  const [activeReportOpportunity, setActiveReportOpportunity] = useState<ReportParticipationOpportunity | null>(null);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'given' | 'received' | 'reports'>('given');
  const [expandedAppealIds, setExpandedAppealIds] = useState<Set<string>>(new Set());
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
      setActiveRatingOpportunity(null);
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
      setActiveReportOpportunity(null);
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
      setExpandedAppealIds((current) => {
        const next = new Set(current);
        next.delete(sanctionId);
        return next;
      });
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

  const toggleAppealForm = (sanctionId: string) => {
    setExpandedAppealIds((current) => {
      const next = new Set(current);
      if (next.has(sanctionId)) {
        next.delete(sanctionId);
      } else {
        next.add(sanctionId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <div className={styles.loadingShell}>
          <article className={styles.stateCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.loadingTitle}>Cargando confianza</h1>
            <p className={styles.loadingText}>
              Estamos preparando tus calificaciones, reportes y restricciones.
            </p>
          </article>
        </div>
      </section>
    );
  }

  if (!operationalAccess.hasOperationalMembership && operationalAccess.title && operationalAccess.message) {
    return (
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <div className={styles.lockedShell}>
          <article className={styles.lockedCard}>
            <div className={styles.lockedHeader}>
              <p className={styles.kicker}>Confianza</p>
              <h1 className={styles.lockedTitle}>Operaci&oacute;n no disponible</h1>
              <div className={styles.lockedActions}>
                <StatusPill label="Operaci&oacute;n bloqueada" tone="warning" />
              </div>
            </div>
            <div className={styles.lockedBody}>
              <OperationalAccessCard
                message={operationalAccess.message}
                title={operationalAccess.title}
              />
            </div>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <header className={styles.heroHeader}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Confianza</p>
          <h1 className={styles.heroTitle}>Reputaci&oacute;n y seguridad</h1>
          <p className={styles.heroLead}>
            Resuelve pendientes, revisa restricciones y conserva un historial claro.
          </p>
        </div>
        <div className={styles.heroActions}>
          <span className={`${styles.heroBadge} ${getBadgeClass(totalPendingActions ? 'warning' : 'success')}`}>
            {totalPendingActions} pendientes
          </span>
          {trustSummary ? (
            <span
              className={`${styles.heroBadge} ${getBadgeClass(getVisibleReputationTone(trustSummary.visibleReputationState))}`}
            >
              {getVisibleReputationStateLabel(trustSummary.visibleReputationState)}
            </span>
          ) : null}
          <button
            className={styles.heroBtnSecondary}
            disabled={isRefreshingData}
            onClick={() => void refreshData(true)}
            type="button"
          >
            {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.workspaceLayout}>
        
        {trustSummary ? (
          <aside className={styles.trustSidebar}>
              <article className={styles.surfaceCard}>
                <div className={styles.surfaceHeader}>
                  <div>
                    <h3 className={styles.surfaceTitle}>Tu Estado</h3>
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
              </article>

              <article className={styles.surfaceCard}>
                <div className={styles.surfaceHeader}>
                  <div>
                    <h3 className={styles.surfaceTitle}>Se&ntilde;ales actuales</h3>
                    <p className={styles.sectionMeta}>{riskSignalsCount} detectadas</p>
                  </div>
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
              </article>

              {trustSummary.activeSanctions && trustSummary.activeSanctions.length > 0 ? (
                <article className={styles.surfaceCard}>
                  <div className={styles.surfaceHeader}>
                    <div>
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
                        <div key={sanction.id} className={`${styles.recordCard} ${styles.recordCardAccent}`}>
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
                              <p className={styles.noteText}>Apelaci&oacute;n: {linkedAppeal.reason}</p>
                              {linkedAppeal.reviewNote ? (
                                <p className={styles.noteText}>Revisi&oacute;n: {linkedAppeal.reviewNote}</p>
                              ) : null}
                            </>
                          ) : canAppeal ? (
                          expandedAppealIds.has(sanction.id) ? (
                            <div className={styles.appealBlock}>
                              <TextareaField
                                label="Motivo de apelaci&oacute;n"
                                onChange={(event) =>
                                  handleSanctionAppealDraftChange(sanction.id, event.target.value)
                                }
                                placeholder="Explica por qu&eacute; consideras que la restricci&oacute;n debe revisarse"
                                rows={3}
                                value={appealDraft}
                              />
                              <p className={styles.helperText}>
                                M&iacute;nimo {SANCTION_APPEAL_REASON_MIN_LENGTH} caracteres.
                              </p>
                              <div className={styles.actionRow}>
                                <Button variant="ghost" onClick={() => toggleAppealForm(sanction.id)}>
                                  Cancelar
                                </Button>
                                <Button
                                  disabled={
                                    isSubmittingSanctionAppealId === sanction.id ||
                                    appealDraft.trim().length < SANCTION_APPEAL_REASON_MIN_LENGTH
                                  }
                                  onClick={() => void handleSubmitSanctionAppeal(sanction.id)}
                                >
                                  {isSubmittingSanctionAppealId === sanction.id
                                    ? 'Enviando apelaci&oacute;n...'
                                    : 'Enviar apelaci&oacute;n'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className={styles.actionRow} style={{ marginTop: '0.5rem' }}>
                              <Button variant="secondary" onClick={() => toggleAppealForm(sanction.id)}>
                                Apelar restricci&oacute;n
                              </Button>
                            </div>
                          )
                          ) : (
                            <p className={styles.noteText}>Esta advertencia no requiere apelaci&oacute;n.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              ) : null}

              {sanctionAppeals.length > 0 ? (
                <article className={styles.surfaceCard}>
                  <div className={styles.surfaceHeader}>
                    <div>
                      <h3 className={styles.surfaceTitle}>Apelaciones</h3>
                    </div>
                    <StatusPill label={`${sanctionAppeals.length} registradas`} tone="neutral" />
                  </div>
                  <div className={styles.stackList}>
                    {sanctionAppeals.map((appeal) => (
                      <div key={appeal.id} className={`${styles.recordCard} ${styles.recordCardAccent}`}>
                        <div className={styles.recordHeader}>
                          <strong>{getOperationalSanctionTypeLabel(appeal.sanctionType)}</strong>
                          <StatusPill
                            label={getSanctionAppealStatusLabel(appeal.status)}
                            tone={getSanctionAppealStatusTone(appeal.status)}
                          />
                        </div>
                        <p className={styles.noteText}>Motivo: {appeal.reason}</p>
                        <p className={styles.noteText}>Registrada: {formatDateTime(appeal.createdAt)}</p>
                        {appeal.reviewNote ? <p className={styles.noteText}>Revisi&oacute;n: {appeal.reviewNote}</p> : null}
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}
          </aside>
        ) : null}

      <div className={styles.trustMain}>
        {(pendingRatingOpportunities.length > 0 || pendingReportOpportunities.length > 0) && (
          <section className={styles.sectionBlock}>
            <header className={styles.sectionHeader}>
              <div className={styles.sectionHeaderTitleGroup}>
                <h2 className={styles.sectionTitle}>Pendientes de cierre</h2>
              </div>
              <StatusPill
                label={`${totalPendingActions} activos`}
                tone="warning"
              />
            </header>

            <div className={styles.pendingGrid}>
              {pendingRatingOpportunities.length > 0 && (
                <article className={styles.surfaceCard}>
                  <div className={styles.surfaceHeader}>
                    <div>
                      <h3 className={styles.surfaceTitle}>Calificaciones</h3>
                      <p className={styles.sectionMeta}>{pendingRatingOpportunities.length} por resolver</p>
                    </div>
                  </div>
                  <div className={styles.stackList}>
                    {pendingRatingOpportunities.map((opportunity) => (
                      <div 
                        key={opportunity.id}
                        className={`${styles.recordCard} ${highlightedRatingOpportunityIds.has(opportunity.id) ? styles.recordCardAccent : ''}`}
                        id={buildClosureOpportunityElementId('rating', opportunity.id)}
                      >
                        <div className={styles.recordHeader}>
                          <strong>{opportunity.targetFullName}</strong>
                          <StatusPill label="Pendiente" tone="warning" />
                        </div>
                        <div className={styles.tripContext}>
                          <span className={styles.tripRoute}>{opportunity.tripOriginLabel} &rarr; {opportunity.tripDestinationLabel}</span>
                          <span className={styles.tripDate}>Viaje del: {formatDateTime(opportunity.tripDepartureAt)}</span>
                        </div>
                        <div className={styles.incidentBox}>
                          <p className={styles.noteText}>
                            {opportunity.ratingDirectionLabel}
                          </p>
                        </div>
                        <div className={styles.actionRow} style={{ marginTop: '0.8rem' }}>
                          <Button onClick={() => setActiveRatingOpportunity(opportunity)}>
                            Calificar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              )}

              {pendingReportOpportunities.length > 0 && (
                <article className={styles.surfaceCard}>
                  <div className={styles.surfaceHeader}>
                    <div>
                      <h3 className={styles.surfaceTitle}>Reportes</h3>
                      <p className={styles.sectionMeta}>{pendingReportOpportunities.length} por resolver</p>
                    </div>
                  </div>
                  <div className={styles.stackList}>
                    {pendingReportOpportunities.map((opportunity) => (
                      <div 
                        key={opportunity.id} 
                        className={`${styles.recordCard} ${highlightedReportOpportunityIds.has(opportunity.id) ? styles.recordCardAccent : ''}`}
                        id={buildClosureOpportunityElementId('report', opportunity.id)}
                      >
                        <div className={styles.recordHeader}>
                          <strong>{opportunity.targetFullName}</strong>
                          <StatusPill label="Pendiente" tone="danger" />
                        </div>
                        <div className={styles.tripContext}>
                          <span className={styles.tripRoute}>{opportunity.tripOriginLabel} &rarr; {opportunity.tripDestinationLabel}</span>
                          <span className={styles.tripDate}>Salida: {formatDateTime(opportunity.tripDepartureAt)}</span>
                        </div>
                        <div className={styles.incidentBox}>
                          <div className={styles.badgeRowStart}>
                            <StatusPill label={opportunity.incidentLabel} tone={opportunity.incidentTone} />
                          </div>
                          <p className={styles.noteText}>
                            {opportunity.incidentSummary}
                          </p>
                          {opportunity.tripClosureNote ? (
                            <div className={styles.reviewBlock}>
                              <strong>Nota de cierre operativo:</strong>
                              <p>{opportunity.tripClosureNote}</p>
                            </div>
                          ) : null}
                        </div>
                        <div className={styles.actionRow} style={{ marginTop: '0.8rem' }}>
                          <Button variant="secondary" onClick={() => setActiveReportOpportunity(opportunity)}>
                            Reportar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              )}
            </div>
          </section>
        )}

        <section className={styles.sectionBlock}>
          <header className={styles.sectionHeader}>
            <div className={styles.sectionHeaderTitleGroup}>
              <h2 className={styles.sectionTitle}>Registro de actividad</h2>
            </div>
          </header>

          <article className={styles.surfaceCard}>
            <nav className={styles.dashboardTabs}>
              <button
                className={[styles.dashboardTab, activeHistoryTab === 'given' ? styles.dashboardTabActive : ''].join(' ')}
                onClick={() => setActiveHistoryTab('given')}
              >
                Calificaciones emitidas ({ratings.given.length})
              </button>
              <button
                className={[styles.dashboardTab, activeHistoryTab === 'received' ? styles.dashboardTabActive : ''].join(' ')}
                onClick={() => setActiveHistoryTab('received')}
              >
                Calificaciones recibidas ({ratings.received.length})
              </button>
              <button
                className={[styles.dashboardTab, activeHistoryTab === 'reports' ? styles.dashboardTabActive : ''].join(' ')}
                onClick={() => setActiveHistoryTab('reports')}
              >
                Reportes emitidos ({reports.length})
              </button>
            </nav>

            <div>
              {activeHistoryTab === 'given' && (
                ratings.given.length ? (
                  <div className={styles.scrollArea}>
                    {ratings.given.map((rating) => (
                      <div key={rating.id} className={styles.recordCard}>
                        <div className={styles.recordHeader}>
                          <strong>{rating.targetFullName}</strong>
                          <span className={styles.inlineStars}>{getRatingStars(rating.score)} {rating.score}/5</span>
                        </div>
                        <div className={styles.tripContext}>
                          <span className={styles.tripRoute}>{rating.tripOriginLabel} &rarr; {rating.tripDestinationLabel}</span>
                          <span className={styles.tripDate}>Viaje del: {formatDateTime(rating.tripDepartureAt)}</span>
                        </div>
                        {rating.comment ? (
                          <div className={styles.incidentBox}>
                            <div className={styles.reviewBlock}>
                              <strong>Tu comentario:</strong>
                              <p>{rating.comment}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <TrustEmptyStateCopy message="Todav&iacute;a no has emitido calificaciones." />
                )
              )}

              {activeHistoryTab === 'received' && (
                ratings.received.length ? (
                  <div className={styles.scrollArea}>
                    {ratings.received.map((rating) => (
                      <div key={rating.id} className={styles.recordCard}>
                        <div className={styles.recordHeader}>
                          <strong>{rating.authorFullName}</strong>
                          <span className={styles.inlineStars}>{getRatingStars(rating.score)} {rating.score}/5</span>
                        </div>
                        <div className={styles.tripContext}>
                          <span className={styles.tripRoute}>{rating.tripOriginLabel} &rarr; {rating.tripDestinationLabel}</span>
                          <span className={styles.tripDate}>Viaje del: {formatDateTime(rating.tripDepartureAt)}</span>
                        </div>
                        {rating.comment ? (
                          <div className={styles.incidentBox}>
                            <div className={styles.reviewBlock}>
                              <strong>Comentario recibido:</strong>
                              <p>{rating.comment}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <TrustEmptyStateCopy message="A&uacute;n no has recibido calificaciones en la membres&iacute;a activa." />
                )
              )}

              {activeHistoryTab === 'reports' && (
                reports.length ? (
                  <div className={styles.scrollArea}>
                    {reports.map((report) => (
                      <div key={report.id} className={styles.recordCard}>
                        <div className={styles.recordHeader}>
                          <strong>{report.reportedFullName}</strong>
                          <StatusPill
                            label={getReportStatusLabel(report.status)}
                            tone={getReportStatusTone(report.status)}
                          />
                        </div>
                        <div className={styles.tripContext}>
                          <span className={styles.tripRoute}>{report.tripOriginLabel} &rarr; {report.tripDestinationLabel}</span>
                          <span className={styles.tripDate}>Emitido el: {formatDateTime(report.createdAt)}</span>
                        </div>
                        <div className={styles.incidentBox}>
                          <div className={styles.badgeRowStart}>
                            <StatusPill
                              label={getReportSeverityLabel(report.reason)}
                              tone={getReportSeverityTone(report.reason)}
                            />
                            <span className={styles.metaBadge}>{getReportReasonLabel(report.reason)}</span>
                          </div>
                          {report.description ? (
                            <div className={styles.reviewBlock}>
                              <strong>Detalle del reporte:</strong>
                              <p>{report.description}</p>
                            </div>
                          ) : null}
                        </div>
                        {report.reviewNote ? (
                          <div className={styles.reviewBlock}>
                            <strong>Respuesta administrativa:</strong>
                            <p>{report.reviewNote}</p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <TrustEmptyStateCopy message="A&uacute;n no has enviado reportes desde esta membres&iacute;a." />
                )
              )}
            </div>
          </article>
        </section>
      </div>
      </div>
      </div>

        {activeRatingOpportunity && (
          <div className={styles.modalOverlay} role="presentation">
            <div className={styles.modalContent} role="dialog" aria-modal="true">
              <RatingOpportunityCard
                isSubmitting={isSubmittingRatingId === activeRatingOpportunity.id}
                onChange={(field, value) => handleRatingDraftChange(activeRatingOpportunity.id, field, value)}
                onSubmit={() => void handleCreateRating(activeRatingOpportunity)}
                opportunity={{
                  id: activeRatingOpportunity.id,
                  tripId: activeRatingOpportunity.tripId,
                  targetMembershipId: activeRatingOpportunity.targetMembershipId,
                  targetFullName: activeRatingOpportunity.targetFullName,
                  tripOriginLabel: activeRatingOpportunity.tripOriginLabel,
                  tripDestinationLabel: activeRatingOpportunity.tripDestinationLabel,
                  tripDepartureAt: activeRatingOpportunity.tripDepartureAt,
                  directionLabel: activeRatingOpportunity.ratingDirectionLabel,
                  windowClosesAt: activeRatingOpportunity.windowClosesAt,
                } satisfies RatingOpportunity}
                value={ratingDrafts[activeRatingOpportunity.id] ?? EMPTY_RATING_DRAFT}
              />
              <div className={styles.modalFooterCard}>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveRatingOpportunity(null)} 
                  style={{ width: '100%' }}
                >
                  Cancelar y cerrar
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeReportOpportunity && (
          <div className={styles.modalOverlay} role="presentation">
            <div className={styles.modalContent} role="dialog" aria-modal="true">
              <ReportOpportunityCard
                isSubmitting={isSubmittingReportId === activeReportOpportunity.id}
                isUploadingEvidence={isUploadingReportEvidenceId === activeReportOpportunity.id}
                onChange={(field, value) => handleReportDraftChange(activeReportOpportunity, activeReportOpportunity.id, field as 'reason' | 'description', value)}
                onEvidenceValidationError={handleReportEvidenceValidationError}
                onSubmit={() => void handleCreateReport(activeReportOpportunity)}
                onUploadEvidence={(file: File) => void handleUploadReportEvidence(activeReportOpportunity, activeReportOpportunity.id, file)}
                opportunity={{
                  id: activeReportOpportunity.id,
                  tripId: activeReportOpportunity.tripId,
                  reportedMembershipId: activeReportOpportunity.targetMembershipId,
                  reportedFullName: activeReportOpportunity.targetFullName,
                  tripOriginLabel: activeReportOpportunity.tripOriginLabel,
                  tripDestinationLabel: activeReportOpportunity.tripDestinationLabel,
                  tripDepartureAt: activeReportOpportunity.tripDepartureAt,
                  directionLabel: activeReportOpportunity.reportDirectionLabel,
                  incidentLabel: activeReportOpportunity.incidentLabel,
                  incidentTone: activeReportOpportunity.incidentTone,
                  incidentSummary: activeReportOpportunity.incidentSummary,
                  tripClosureNote: activeReportOpportunity.tripClosureNote,
                  windowClosesAt: activeReportOpportunity.windowClosesAt,
                } satisfies ReportOpportunity}
                value={reportDrafts[activeReportOpportunity.id] ?? getInitialReportDraft(activeReportOpportunity)}
              />
              <div className={styles.modalFooterCard}>
                <Button 
                  variant="ghost" 
                  onClick={() => setActiveReportOpportunity(null)} 
                  style={{ width: '100%' }}
                >
                  Cancelar y cerrar
                </Button>
              </div>
            </div>
          </div>
        )}
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
