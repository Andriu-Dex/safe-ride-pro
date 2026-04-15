'use client';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { TextareaField } from '../../../components/ui/textarea-field';
import {
  REPORT_REASON_OPTIONS,
  getReportReasonLabel,
} from '../lib/report-labels';

export type ReportOpportunity = {
  id: string;
  tripId: string;
  reportedMembershipId: string;
  reportedFullName: string;
  tripOriginLabel: string;
  tripDestinationLabel: string;
  tripDepartureAt: string;
  directionLabel: string;
  incidentSummary: string;
};

type ReportDraft = {
  reason: string;
  description: string;
  evidenceFileKey: string;
};

type ReportOpportunityCardProps = {
  opportunity: ReportOpportunity;
  value: ReportDraft;
  isSubmitting: boolean;
  onChange: (field: keyof ReportDraft, value: string) => void;
  onSubmit: () => void;
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}

export function ReportOpportunityCard({
  opportunity,
  value,
  isSubmitting,
  onChange,
  onSubmit,
}: ReportOpportunityCardProps) {
  return (
    <div className="list-card">
      <div className="list-card-header">
        <strong>{opportunity.reportedFullName}</strong>
        <span className="topbar-badge">{opportunity.directionLabel}</span>
      </div>

      <p className="panel-text">
        Viaje: {opportunity.tripOriginLabel} -&gt; {opportunity.tripDestinationLabel}
      </p>
      <p className="panel-text">Salida: {formatDateTime(opportunity.tripDepartureAt)}</p>
      <p className="form-helper compact-helper">{opportunity.incidentSummary}</p>

      <div className="form-grid form-grid-2 compact-grid">
        <SelectField
          label="Motivo principal"
          onChange={(event) => onChange('reason', event.target.value)}
          value={value.reason}
        >
          {REPORT_REASON_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>

        <div className="form-helper compact-helper">
          Se registrara el motivo "{getReportReasonLabel(value.reason)}" en el historial del caso.
        </div>
      </div>

      <TextareaField
        label="Descripcion"
        onChange={(event) => onChange('description', event.target.value)}
        placeholder="Describe lo ocurrido con el mayor contexto posible"
        rows={4}
        value={value.description}
      />

      <InputField
        label="Referencia de evidencia"
        hint="Opcional. Por ahora puedes usar una clave, nombre de archivo o referencia interna."
        onChange={(event) => onChange('evidenceFileKey', event.target.value)}
        placeholder="Ejemplo: evidencia-reporte-001"
        value={value.evidenceFileKey}
      />

      <div className="button-row">
        <Button disabled={isSubmitting} onClick={onSubmit} variant="secondary">
          Registrar reporte
        </Button>
      </div>
    </div>
  );
}
