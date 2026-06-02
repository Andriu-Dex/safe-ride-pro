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
                    <div className={styles.badgeRowStart}>
                      <StatusPill label="Pendiente" tone="danger" />
                      <StatusPill label={opportunity.incidentLabel} tone={opportunity.incidentTone} />
                    </div>
                  </div>
                  <div className={styles.tripContext}>
                    <span className={styles.tripRoute}>{opportunity.tripOriginLabel} &rarr; {opportunity.tripDestinationLabel}</span>
                    <span className={styles.tripDate}>Salida: {formatDateTime(opportunity.tripDepartureAt)}</span>
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
  );
}
