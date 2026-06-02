'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { OperationalAccessCard } from '../../../components/ui/operational-access-card';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastStack, type ToastItem } from '../../../components/ui/toast-stack';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { ApiError } from '../../../lib/api-client';

import { RatingOpportunityCard, type RatingOpportunity } from '../../../modules/ratings/components/rating-opportunity-card';
import { createRating } from '../../../modules/ratings/lib/rating-api';
import { ReportOpportunityCard, type ReportOpportunity } from '../../../modules/reports/components/report-opportunity-card';
import { createReport, uploadReportEvidence } from '../../../modules/reports/lib/report-api';

import { getVisibleReputationTone, getVisibleReputationStateLabel } from '../../../modules/users/lib/trust-labels';

import { useTrustData } from './hooks/use-trust-data';
import { TrustSidebar } from './components/trust-sidebar';
import { PendingActions } from './components/pending-actions';
import { ActivityHistory } from './components/activity-history';

import {
  buildRatingOpportunities,
  buildReportOpportunities,
  getInitialReportDraft,
  matchesClosureFocus,
  buildClosureOpportunityElementId,
  getApiErrorMessage,
} from './utils/trust-helpers';

import {
  RatingDraft,
  ReportDraft,
  EMPTY_RATING_DRAFT,
  RatingParticipationOpportunity,
  ReportParticipationOpportunity,
} from './types/trust-types';

import styles from './styles/trust-layout.module.css';

export default function TrustPage() {
  const trustData = useTrustData();

  const {
    authSession,
    isHydrated,
    operationalAccess,
    defaultMembershipId,
    trustSummary,
    ratings,
    reports,
    sanctionAppeals,
    myRequests,
    incomingRequests,
    isLoading,
    isRefreshingData,
    errorMessage,
    setErrorMessage,
    successMessage,
    setSuccessMessage,
    refreshData,
    refreshSession,
    searchParams,
    loadData,
  } = trustData;

  const [ratingDrafts, setRatingDrafts] = useState<Record<string, RatingDraft>>({});
  const [reportDrafts, setReportDrafts] = useState<Record<string, ReportDraft>>({});
  const [activeRatingOpportunity, setActiveRatingOpportunity] = useState<RatingParticipationOpportunity | null>(null);
  const [activeReportOpportunity, setActiveReportOpportunity] = useState<ReportParticipationOpportunity | null>(null);

  const [isSubmittingRatingId, setIsSubmittingRatingId] = useState<string | null>(null);
  const [isSubmittingReportId, setIsSubmittingReportId] = useState<string | null>(null);
  const [isUploadingReportEvidenceId, setIsUploadingReportEvidenceId] = useState<string | null>(null);
  
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const reportDraftsRef = useRef(reportDrafts);

  const pushToast = (title: string, description: string, tone: ToastItem['tone'] = 'info') => {
    setToasts((current) => [
      ...current,
      { id: `trust-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`, title, description, tone },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  };

  useAutoRefresh(
    async () => { await refreshData(); },
    { enabled: Boolean(authSession && isHydrated && operationalAccess.hasOperationalMembership), intervalMs: 20_000 }
  );

  useEffect(() => {
    reportDraftsRef.current = reportDrafts;
  }, [reportDrafts]);

  useEffect(() => {
    if (!errorMessage) return;
    pushToast('No se pudo completar la accion', errorMessage, 'error');
    setErrorMessage(null);
  }, [errorMessage, setErrorMessage]);

  useEffect(() => {
    if (!successMessage) return;
    pushToast('Accion completada', successMessage, 'success');
    setSuccessMessage(null);
  }, [successMessage, setSuccessMessage]);

  useEffect(() => {
    return () => {
      Object.values(reportDraftsRef.current).forEach((draft) => {
        if (draft.evidencePreviewUrl) URL.revokeObjectURL(draft.evidencePreviewUrl);
      });
    };
  }, []);

  const ratingOpportunities = useMemo(
    () => buildRatingOpportunities(defaultMembershipId, myRequests, incomingRequests),
    [defaultMembershipId, incomingRequests, myRequests]
  );
  
  const reportOpportunities = useMemo(
    () => buildReportOpportunities(defaultMembershipId, myRequests, incomingRequests),
    [defaultMembershipId, incomingRequests, myRequests]
  );

  const givenRatingKeys = useMemo(
    () => new Set(ratings.given.map((r) => `${r.tripId}:${r.targetMembershipId}`)),
    [ratings.given]
  );
  
  const reportedKeys = useMemo(
    () => new Set(reports.map((r) => `${r.tripId}:${r.reportedMembershipId}`)),
    [reports]
  );

  const pendingRatingOpportunities = ratingOpportunities.filter((opp) => !givenRatingKeys.has(opp.id));
  const pendingReportOpportunities = reportOpportunities.filter((opp) => !reportedKeys.has(opp.id));
  const totalPendingActions = pendingRatingOpportunities.length + pendingReportOpportunities.length;

  const focusedKind = searchParams.get('focus');
  const focusedTripId = searchParams.get('tripId');
  const focusedMembershipId = searchParams.get('membershipId');

  const highlightedRatingOpportunityIds = useMemo(
    () => new Set(pendingRatingOpportunities.filter((opp) => matchesClosureFocus(opp.tripId, opp.targetMembershipId, focusedTripId, focusedMembershipId)).map((opp) => opp.id)),
    [focusedMembershipId, focusedTripId, pendingRatingOpportunities]
  );

  const highlightedReportOpportunityIds = useMemo(
    () => new Set(pendingReportOpportunities.filter((opp) => matchesClosureFocus(opp.tripId, opp.targetMembershipId, focusedTripId, focusedMembershipId)).map((opp) => opp.id)),
    [focusedMembershipId, focusedTripId, pendingReportOpportunities]
  );

  useEffect(() => {
    if (!focusedTripId || (focusedKind !== 'rating' && focusedKind !== 'report')) return;

    const highlightedIds = focusedKind === 'rating' ? Array.from(highlightedRatingOpportunityIds) : Array.from(highlightedReportOpportunityIds);
    if (!highlightedIds.length) return;

    const targetElement = document.getElementById(buildClosureOpportunityElementId(focusedKind, highlightedIds[0]));
    if (!targetElement) return;

    window.setTimeout(() => { targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120);
  }, [focusedKind, focusedTripId, highlightedRatingOpportunityIds, highlightedReportOpportunityIds]);

  const handleRatingDraftChange = (opportunityId: string, field: keyof RatingDraft, value: string) => {
    setRatingDrafts((current) => ({
      ...current,
      [opportunityId]: { ...(current[opportunityId] ?? EMPTY_RATING_DRAFT), [field]: value },
    }));
  };

  const handleReportDraftChange = (opportunity: ReportParticipationOpportunity, opportunityId: string, field: 'reason' | 'description', value: string) => {
    setReportDrafts((current) => ({
      ...current,
      [opportunityId]: { ...(current[opportunityId] ?? getInitialReportDraft(opportunity)), [field]: value },
    }));
  };

  const handleCreateRating = async (opportunity: RatingParticipationOpportunity) => {
    if (!authSession) return;

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
      setRatingDrafts((current) => ({ ...current, [opportunity.id]: EMPTY_RATING_DRAFT }));
      setActiveRatingOpportunity(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) await refreshSession().catch(() => undefined);
      setErrorMessage(getApiErrorMessage(error, 'No fue posible registrar la calificacion.'));
      await refreshData();
    } finally {
      setIsSubmittingRatingId(null);
    }
  };

  const handleCreateReport = async (opportunity: ReportParticipationOpportunity) => {
    if (!authSession) return;

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
        if (currentDraft.evidencePreviewUrl) URL.revokeObjectURL(currentDraft.evidencePreviewUrl);
        return { ...currentDrafts, [opportunity.id]: getInitialReportDraft(opportunity) };
      });
      setActiveReportOpportunity(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) await refreshSession().catch(() => undefined);
      setErrorMessage(getApiErrorMessage(error, 'No fue posible registrar el reporte.'));
      await refreshData();
    } finally {
      setIsSubmittingReportId(null);
    }
  };

  const handleUploadReportEvidence = async (opportunity: ReportParticipationOpportunity, opportunityId: string, file: File) => {
    if (!authSession) return;
    setIsUploadingReportEvidenceId(opportunityId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await uploadReportEvidence(authSession.accessToken, file);
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

      setReportDrafts((current) => {
        const draft = current[opportunityId] ?? getInitialReportDraft(opportunity);
        if (draft.evidencePreviewUrl) URL.revokeObjectURL(draft.evidencePreviewUrl);
        return {
          ...current,
          [opportunityId]: {
            ...draft,
            evidenceFileKey: response.fileKey,
            evidenceFileName: file.name,
            evidencePreviewUrl: previewUrl,
            evidenceMimeType: file.type || null,
          },
        };
      });
      setSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) await refreshSession().catch(() => undefined);
      setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar la evidencia del reporte.'));
    } finally {
      setIsUploadingReportEvidenceId(null);
    }
  };

  if (isLoading) {
    return (
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <div className={styles.loadingShell}>
          <article className={styles.stateCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.loadingTitle}>Cargando confianza</h1>
            <p className={styles.loadingText}>Preparando datos.</p>
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
              <h1 className={styles.lockedTitle}>Operación no disponible</h1>
              <div className={styles.lockedActions}>
                <StatusPill label="Operación bloqueada" tone="warning" />
              </div>
            </div>
            <div className={styles.lockedBody}>
              <OperationalAccessCard message={operationalAccess.message} title={operationalAccess.title} />
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
          <h1 className={styles.heroTitle}>Reputación y seguridad</h1>
          <p className={styles.heroLead}>Historial, pendientes y restricciones.</p>
        </div>
        <div className={styles.heroActions}>
          <span className={`${styles.heroBadge} ${totalPendingActions ? styles.heroBadgeWarning : styles.heroBadgeSuccess}`}>
            {totalPendingActions} pendientes
          </span>
          {trustSummary ? (
            <span className={`${styles.heroBadge} ${styles.heroBadgeNeutral}`}>
              {getVisibleReputationStateLabel(trustSummary.visibleReputationState)}
            </span>
          ) : null}
          <button className={styles.heroBtnSecondary} disabled={isRefreshingData} onClick={() => void refreshData(true)} type="button">
            {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.workspaceLayout}>
          {trustSummary && (
            <TrustSidebar
              trustSummary={trustSummary}
              sanctionAppeals={sanctionAppeals}
              authSession={authSession}
              onRefreshData={() => refreshData()}
              setErrorMessage={setErrorMessage}
              setSuccessMessage={setSuccessMessage}
            />
          )}

          <div className={styles.trustMain}>
            <PendingActions
              pendingRatingOpportunities={pendingRatingOpportunities}
              pendingReportOpportunities={pendingReportOpportunities}
              totalPendingActions={totalPendingActions}
              highlightedRatingOpportunityIds={highlightedRatingOpportunityIds}
              highlightedReportOpportunityIds={highlightedReportOpportunityIds}
              setActiveRatingOpportunity={setActiveRatingOpportunity}
              setActiveReportOpportunity={setActiveReportOpportunity}
            />

            <ActivityHistory ratings={ratings} reports={reports} />
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
              onClose={() => setActiveRatingOpportunity(null)}
            />
          </div>
        </div>
      )}

      {activeReportOpportunity && (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.modalContent} role="dialog" aria-modal="true">
            <ReportOpportunityCard
              isSubmitting={isSubmittingReportId === activeReportOpportunity.id}
              isUploadingEvidence={isUploadingReportEvidenceId === activeReportOpportunity.id}
              onChange={(field, value) => handleReportDraftChange(activeReportOpportunity, activeReportOpportunity.id, field, value)}
              onEvidenceValidationError={(msg) => { setErrorMessage(msg); setSuccessMessage(null); }}
              onSubmit={() => void handleCreateReport(activeReportOpportunity)}
              onUploadEvidence={(file) => void handleUploadReportEvidence(activeReportOpportunity, activeReportOpportunity.id, file)}
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
              onClose={() => setActiveReportOpportunity(null)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
