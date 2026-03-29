'use client';

import {
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InfoCard } from '../../../components/ui/info-card';
import { StatusPill } from '../../../components/ui/status-pill';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { RatingOpportunityCard, type RatingOpportunity } from '../../../modules/ratings/components/rating-opportunity-card';
import { createRating, listMyRatings } from '../../../modules/ratings/lib/rating-api';
import { getRatingStars } from '../../../modules/ratings/lib/rating-labels';
import type { RatingList } from '../../../modules/ratings/types/rating';
import { ReportOpportunityCard, type ReportOpportunity } from '../../../modules/reports/components/report-opportunity-card';
import { createReport, listMyReports } from '../../../modules/reports/lib/report-api';
import { getReportReasonLabel, getReportStatusLabel, getReportStatusTone } from '../../../modules/reports/lib/report-labels';
import type { ReportRecord } from '../../../modules/reports/types/report';
import { listIncomingTripRequests, listMyTripRequests } from '../../../modules/trip-requests/lib/trip-request-api';
import type { TripRequestRecord } from '../../../modules/trip-requests/types/trip-request';
import { getCurrentUserTrustSummary } from '../../../modules/users/lib/user-api';
import type { TrustSummary } from '../../../modules/users/types/trust-summary';

type RatingDraft = {
  score: string;
  comment: string;
};

type ReportDraft = {
  reason: string;
  description: string;
  evidenceFileKey: string;
};

const EMPTY_RATING_DRAFT: RatingDraft = {
  score: '5',
  comment: '',
};

const EMPTY_REPORT_DRAFT: ReportDraft = {
  reason: 'UNSAFE_DRIVING',
  description: '',
  evidenceFileKey: '',
};

type ParticipationOpportunity = {
  id: string;
  tripId: string;
  targetMembershipId: string;
  targetFullName: string;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: string;
  ratingDirectionLabel: string;
  reportDirectionLabel: string;
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

function buildParticipationOpportunities(
  membershipId: string | undefined,
  myRequests: TripRequestRecord[],
  incomingRequests: TripRequestRecord[],
): ParticipationOpportunity[] {
  if (!membershipId) {
    return [];
  }

  const items = new Map<string, ParticipationOpportunity>();

  const registerOpportunity = (opportunity: ParticipationOpportunity) => {
    if (!items.has(opportunity.id)) {
      items.set(opportunity.id, opportunity);
    }
  };

  myRequests.forEach((request) => {
    if (
      request.status !== TripRequestStatus.Accepted ||
      request.tripStatus !== TripStatus.Completed
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
      reportDirectionLabel: 'Reportar al conductor',
    });
  });

  incomingRequests.forEach((request) => {
    if (
      request.driverMembershipId !== membershipId ||
      request.status !== TripRequestStatus.Accepted ||
      request.tripStatus !== TripStatus.Completed
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
      reportDirectionLabel: 'Reportar al pasajero',
    });
  });

  return Array.from(items.values()).sort(
    (left, right) =>
      new Date(right.tripDepartureAt).getTime() - new Date(left.tripDepartureAt).getTime(),
  );
}

export default function TrustPage() {
  const { authSession, isHydrated } = useAuth();
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [ratings, setRatings] = useState<RatingList>({ given: [], received: [] });
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [myRequests, setMyRequests] = useState<TripRequestRecord[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<TripRequestRecord[]>([]);
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, RatingDraft>>({});
  const [reportDrafts, setReportDrafts] = useState<Record<string, ReportDraft>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isSubmittingRatingId, setIsSubmittingRatingId] = useState<string | null>(null);
  const [isSubmittingReportId, setIsSubmittingReportId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const defaultMembershipId = authSession?.user.memberships.find((membership) => membership.isDefault)?.id
    ?? authSession?.user.memberships[0]?.id;

  const loadData = async (accessToken: string) => {
    const [trustSummaryData, ratingsData, reportsData, myTripRequests, incomingTripRequests] = await Promise.all([
      getCurrentUserTrustSummary(accessToken),
      listMyRatings(accessToken),
      listMyReports(accessToken),
      listMyTripRequests(accessToken),
      listIncomingTripRequests(accessToken),
    ]);

    setTrustSummary(trustSummaryData);
    setRatings(ratingsData);
    setReports(reportsData);
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
      setErrorMessage(getApiErrorMessage(error, 'No fue posible sincronizar calificaciones y reportes.'));
    } finally {
      if (showSpinner) {
        setIsRefreshingData(false);
      }
    }
  };

  useEffect(() => {
    if (!isHydrated || !authSession) {
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
  }, [authSession, isHydrated]);

  useAutoRefresh(
    async () => {
      await refreshData();
    },
    {
      enabled: Boolean(authSession && isHydrated),
      intervalMs: 20_000,
    },
  );

  const participationOpportunities = useMemo(
    () => buildParticipationOpportunities(defaultMembershipId, myRequests, incomingRequests),
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

  const pendingRatingOpportunities = participationOpportunities.filter(
    (opportunity) => !givenRatingKeys.has(opportunity.id),
  );
  const pendingReportOpportunities = participationOpportunities.filter(
    (opportunity) => !reportedKeys.has(opportunity.id),
  );

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
    opportunityId: string,
    field: keyof ReportDraft,
    value: string,
  ) => {
    setReportDrafts((currentDrafts) => ({
      ...currentDrafts,
      [opportunityId]: {
        ...(currentDrafts[opportunityId] ?? EMPTY_REPORT_DRAFT),
        [field]: value,
      },
    }));
  };

  const handleCreateRating = async (opportunity: ParticipationOpportunity) => {
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
      setErrorMessage(getApiErrorMessage(error, 'No fue posible registrar la calificacion.'));
      await refreshData();
    } finally {
      setIsSubmittingRatingId(null);
    }
  };

  const handleCreateReport = async (opportunity: ParticipationOpportunity) => {
    if (!authSession) {
      return;
    }

    const draft = reportDrafts[opportunity.id] ?? EMPTY_REPORT_DRAFT;
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
      setReportDrafts((currentDrafts) => ({
        ...currentDrafts,
        [opportunity.id]: EMPTY_REPORT_DRAFT,
      }));
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No fue posible registrar el reporte.'));
      await refreshData();
    } finally {
      setIsSubmittingReportId(null);
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

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Confianza</h1>
          <p className="topbar-subtitle">
            Revisa tu reputacion, califica a otros participantes y registra incidentes de viajes completados.
          </p>
        </div>
        <div className="topbar-actions">
          <Button
            disabled={isRefreshingData}
            onClick={() => void refreshData(true)}
            variant="secondary"
          >
            {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
          </Button>
          <StatusPill
            label={`${pendingRatingOpportunities.length + pendingReportOpportunities.length} acciones pendientes`}
            tone={pendingRatingOpportunities.length || pendingReportOpportunities.length ? 'warning' : 'success'}
          />
        </div>
      </header>

      <section className="content-grid">
        <div className="metrics-grid">
          <InfoCard
            description="Viajes completados donde aun puedes registrar una calificacion."
            label="Calificaciones pendientes"
            value={`${pendingRatingOpportunities.length}`}
          />
          <InfoCard
            description="Casos disponibles para reportar dentro de tus viajes completados."
            label="Reportes pendientes"
            value={`${pendingReportOpportunities.length}`}
          />
          <InfoCard
            description="Total de calificaciones recibidas por tu membresia activa."
            label="Reputacion recibida"
            value={`${ratings.received.length}`}
          />
          <InfoCard
            description="Promedio actual de calificaciones recibidas por tu membresia activa."
            label="Promedio actual"
            value={formatAverageScore(trustSummary?.averageRatingReceived ?? null)}
          />
          <InfoCard
            description="Viajes completados como conductor desde tu membresia activa."
            label="Viajes como conductor"
            value={`${trustSummary?.completedTripsAsDriver ?? 0}`}
          />
          <InfoCard
            description="Viajes completados como pasajero desde tu membresia activa."
            label="Viajes como pasajero"
            value={`${trustSummary?.completedTripsAsPassenger ?? 0}`}
          />
          <InfoCard
            description="Cancelaciones tardias registradas en tus viajes como conductor."
            label="Cancelaciones tardias"
            value={`${trustSummary?.lateDriverTripCancellations ?? 0}`}
          />
          <InfoCard
            description="Solicitudes canceladas tarde y no-shows registrados en tu membresia activa."
            label="Riesgos operativos"
            value={`${
              (trustSummary?.latePassengerTripRequestCancellations ?? 0) +
              (trustSummary?.passengerNoShows ?? 0)
            }`}
          />
        </div>

        {trustSummary ? (
          <div className="form-helper">
            Ventana de cancelacion tardia vigente: {trustSummary.cancellationPolicy.lateWindowMinutes} minutos antes de la salida.
            Ultimo calculo: {formatDateTime(trustSummary.cancellationPolicy.lastComputedAt)}.
          </div>
        ) : null}

        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        {successMessage ? <div className="form-success">{successMessage}</div> : null}

        <div className="page-grid page-grid-wide">
          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Calificaciones pendientes</h2>
              <p className="section-heading-meta">{pendingRatingOpportunities.length} disponibles</p>
            </div>
            {pendingRatingOpportunities.length ? (
              <div className="list-stack">
                {pendingRatingOpportunities.map((opportunity) => (
                  <RatingOpportunityCard
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
                    } satisfies RatingOpportunity}
                    value={ratingDrafts[opportunity.id] ?? EMPTY_RATING_DRAFT}
                  />
                ))}
              </div>
            ) : (
              <p className="panel-text">
                No tienes calificaciones pendientes. Tu historial esta al dia con los viajes completados actuales.
              </p>
            )}
          </article>

          <article className="panel panel-stack">
            <div className="section-heading">
              <h2 className="panel-title">Reportes pendientes</h2>
              <p className="section-heading-meta">{pendingReportOpportunities.length} disponibles</p>
            </div>
            {pendingReportOpportunities.length ? (
              <div className="list-stack">
                {pendingReportOpportunities.map((opportunity) => (
                  <ReportOpportunityCard
                    key={opportunity.id}
                    isSubmitting={isSubmittingReportId === opportunity.id}
                    onChange={(field, value) => handleReportDraftChange(opportunity.id, field, value)}
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
                    } satisfies ReportOpportunity}
                    value={reportDrafts[opportunity.id] ?? EMPTY_REPORT_DRAFT}
                  />
                ))}
              </div>
            ) : (
              <p className="panel-text">
                No tienes reportes pendientes. Si todo salio bien, no necesitas registrar incidentes.
              </p>
            )}
          </article>
        </div>

        <div className="page-grid page-grid-wide">
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
        </div>

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
      </section>
    </>
  );
}
