'use client';

import { Button } from '../../../components/ui/button';
import { SelectField } from '../../../components/ui/select-field';
import { TextareaField } from '../../../components/ui/textarea-field';
import { formatTripClosureDeadline } from '../../trips/lib/trip-closure';

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
        'list-card',
        'list-card-strong',
        highlighted ? 'closure-focus-card' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      id={elementId}
    >
      <div className="list-card-header">
        <strong>{opportunity.targetFullName}</strong>
        <span className="topbar-badge">{opportunity.directionLabel}</span>
      </div>

      <p className="panel-text">
        Viaje: {opportunity.tripOriginLabel} -&gt; {opportunity.tripDestinationLabel}
      </p>
      <p className="panel-text">Salida: {formatDateTime(opportunity.tripDepartureAt)}</p>
      <p className="form-helper compact-helper">
        Disponible hasta {formatTripClosureDeadline(opportunity.windowClosesAt)}.
      </p>

      <div className="form-grid form-grid-2 compact-grid">
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

        <div className="form-helper compact-helper">
          Usa comentarios concretos para dejar un historial util a futuros pasajeros y conductores.
        </div>
      </div>

      <TextareaField
        label="Comentario"
        onChange={(event) => onChange('comment', event.target.value)}
        placeholder="Comentario opcional"
        rows={3}
        value={value.comment}
      />

      <div className="button-row">
        <Button disabled={isSubmitting} onClick={onSubmit}>
          Registrar calificacion
        </Button>
      </div>
    </div>
  );
}
