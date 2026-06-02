import { Button } from '../../../../components/ui/button';
import { StatusPill } from '../../../../components/ui/status-pill';
import { formatDateTime, buildClosureOpportunityElementId } from '../utils/trust-helpers';
import type { RatingParticipationOpportunity, ReportParticipationOpportunity } from '../types/trust-types';
import styles from '../styles/trust-layout.module.css';

export function PendingActions({
  pendingRatingOpportunities,
  pendingReportOpportunities,
  totalPendingActions,
  highlightedRatingOpportunityIds,
  highlightedReportOpportunityIds,
  setActiveRatingOpportunity,
  setActiveReportOpportunity,
}: {
  pendingRatingOpportunities: RatingParticipationOpportunity[];
  pendingReportOpportunities: ReportParticipationOpportunity[];
  totalPendingActions: number;
  highlightedRatingOpportunityIds: Set<string>;
  highlightedReportOpportunityIds: Set<string>;
  setActiveRatingOpportunity: (opp: RatingParticipationOpportunity) => void;
  setActiveReportOpportunity: (opp: ReportParticipationOpportunity) => void;
}) {
  if (totalPendingActions === 0) return null;

  return (
    <section className={styles.sectionBlock}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionHeaderTitleGroup}>
          <h2 className={styles.sectionTitle}>Pendientes</h2>
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
              </div>
            </div>
            <div className={styles.stackList} style={{ gap: '0.8rem' }}>
              {pendingRatingOpportunities.map((opportunity) => (
                <div 
                  key={opportunity.id}
                  className={`${styles.pendingCard} ${highlightedRatingOpportunityIds.has(opportunity.id) ? styles.pendingCardAccent : ''}`}
                  id={buildClosureOpportunityElementId('rating', opportunity.id)}
                >
                  <div className={styles.pendingInfo}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#07182b', fontWeight: 850 }}>{opportunity.targetFullName}</strong>
                    </div>
                    <div className={styles.historyMeta} style={{ color: '#0b1c30', fontWeight: 600 }}>
                      {opportunity.tripOriginLabel} &rarr; {opportunity.tripDestinationLabel}
                    </div>
                    <div className={styles.historyMeta}>
                      Viaje: {formatDateTime(opportunity.tripDepartureAt)}
                    </div>
                  </div>
                  <div className={styles.pendingActions}>
                    <span className={styles.deadlineChip}>
                      Cierra: {new Date(opportunity.windowClosesAt).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
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
              </div>
            </div>
            <div className={styles.stackList} style={{ gap: '0.8rem' }}>
              {pendingReportOpportunities.map((opportunity) => (
                <div 
                  key={opportunity.id} 
                  className={`${styles.pendingCard} ${highlightedReportOpportunityIds.has(opportunity.id) ? styles.pendingCardAccent : ''}`}
                  id={buildClosureOpportunityElementId('report', opportunity.id)}
                >
                  <div className={styles.pendingInfo}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '1.05rem', color: '#07182b', fontWeight: 850 }}>{opportunity.targetFullName}</strong>
                      <StatusPill label={opportunity.incidentLabel} tone={opportunity.incidentTone} />
                    </div>
                    <div className={styles.historyMeta} style={{ color: '#0b1c30', fontWeight: 600 }}>
                      {opportunity.tripOriginLabel} &rarr; {opportunity.tripDestinationLabel}
                    </div>
                    <div className={styles.historyMeta}>
                      Viaje: {formatDateTime(opportunity.tripDepartureAt)}
                    </div>
                  </div>
                  <div className={styles.pendingActions}>
                    <span className={styles.deadlineChip}>
                      Cierra: {new Date(opportunity.windowClosesAt).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
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
  );
}
