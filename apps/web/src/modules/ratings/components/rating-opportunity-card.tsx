'use client';

import { Button } from '../../../components/ui/button';
import { SelectField } from '../../../components/ui/select-field';
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
  highlighted = false,
  elementId,
}: RatingOpportunityCardProps) {
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
      <div className={styles.header}>
        <div className={styles.identity}>
          <strong className={styles.title}>{opportunity.targetFullName}</strong>
          <p className={styles.meta}>
            {opportunity.tripOriginLabel} -&gt; {opportunity.tripDestinationLabel}
          </p>
          <p className={styles.meta}>Salida: {formatDateTime(opportunity.tripDepartureAt)}</p>
        </div>
        <span className="topbar-badge">{opportunity.directionLabel}</span>
      </div>

      <p className={styles.deadline}>Hasta {formatTripClosureDeadline(opportunity.windowClosesAt)}</p>

      <div className={styles.grid}>
        <SelectField
          label="Puntaje"
          onChange={(event) => onChange('score', event.target.value)}
          value={value.score}
        >
          <option value="5">5 - Excelente</option>
          <option value="4">4 - Muy bien</option>
          <option value="3">3 - Bien</option>
          <option value="2">2 - Regular</option>
          <option value="1">1 - Deficiente</option>
        </SelectField>
      </div>

      <TextareaField
        label="Comentario"
        onChange={(event) => onChange('comment', event.target.value)}
        placeholder="Comentario opcional"
        rows={3}
        value={value.comment}
      />

      <div className={styles.actions}>
        <Button disabled={isSubmitting} onClick={onSubmit}>
          Registrar
        </Button>
      </div>
    </div>
  );
}
