'use client';

import { Button } from '../../../components/ui/button';
import { StarRatingField } from '../../../components/ui/star-rating-field';
import { TextareaField } from '../../../components/ui/textarea-field';
import { formatTripClosureDeadline } from '../../trips/lib/trip-closure';
import styles from './rating-opportunity-card.module.css';

export type RatingOpportunity = {
  id: string;
  tripId: string;
  targetMembershipId: string;
  targetFullName: string;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: string;
  directionLabel: string;
  windowClosesAt: string;
};

type RatingDraft = {
  score: string;
  comment: string;
};

type RatingOpportunityCardProps = {
  opportunity: RatingOpportunity;
  value: RatingDraft;
  isSubmitting: boolean;
  onChange: (field: keyof RatingDraft, value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  highlighted?: boolean;
  elementId?: string;
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}

export function RatingOpportunityCard({
  opportunity,
  value,
  isSubmitting,
  onChange,
  onSubmit,
  onClose,
  highlighted = false,
  elementId,
}: RatingOpportunityCardProps) {
  const hasRated = value.score !== '0';

  return (
    <div
      className={[
        styles.card,
        highlighted ? styles.highlighted : null,
      ]
        .filter(Boolean)
        .join(' ')}
      id={elementId}
    >
      <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Cerrar">
        &times;
      </button>

      <div className={styles.header}>
        <div className={styles.identity}>
          <p className={styles.meta}>Calificando a</p>
          <strong className={styles.title}>{opportunity.targetFullName}</strong>
        </div>
        <div className={styles.badges}>
          <span className="topbar-badge">{opportunity.directionLabel}</span>
        </div>
      </div>

      <div className={styles.tripInfoCard}>
        <p className={styles.meta}>
          <strong>Ruta:</strong> {opportunity.tripOriginLabel} &rarr; {opportunity.tripDestinationLabel}
        </p>
        <p className={styles.meta}>
          <strong>Fecha:</strong> {formatDateTime(opportunity.tripDepartureAt)}
        </p>
      </div>

      <div className={styles.ratingSection}>
        <h3 className={styles.ratingPrompt}>¿Cómo fue la experiencia?</h3>
        <div className={styles.starsWrapper}>
          <StarRatingField
            label="Puntaje"
            onChange={(val) => onChange('score', val)}
            value={value.score}
          />
        </div>
      </div>

      {hasRated && (
        <div className={styles.commentSection}>
          <TextareaField
            label="Comentario (Opcional)"
            onChange={(event) => onChange('comment', event.target.value)}
            placeholder="¿Algo que destacar?"
            rows={3}
            value={value.comment}
          />
        </div>
      )}

      <div className={styles.footerRow}>
        <p className={styles.deadline}>Cierra {formatTripClosureDeadline(opportunity.windowClosesAt)}</p>
        <div className={styles.actions}>
          <Button disabled={isSubmitting || !hasRated} onClick={onSubmit} className={styles.submitButton}>
            {isSubmitting ? 'Registrando...' : 'Registrar calificación'}
          </Button>
        </div>
      </div>
    </div>
  );
}
