'use client';

import { useId } from 'react';

import { Button } from '../../../components/ui/button';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { TextareaField } from '../../../components/ui/textarea-field';
import { suppressAuthSessionSync } from '../../auth/lib/auth-sync-guard';
import { formatTripClosureDeadline } from '../../trips/lib/trip-closure';
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
  incidentLabel: string;
  incidentTone: 'neutral' | 'success' | 'warning' | 'danger';
  incidentSummary: string;
  tripClosureNote: string | null;
  windowClosesAt: string;
};

type ReportDraft = {
  reason: string;
  description: string;
  evidenceFileKey: string;
  evidenceFileName: string;
  evidencePreviewUrl: string | null;
  evidenceMimeType: string | null;
};

type ReportOpportunityCardProps = {
  opportunity: ReportOpportunity;
  value: ReportDraft;
  isSubmitting: boolean;
  isUploadingEvidence: boolean;
  onChange: (field: 'reason' | 'description', value: string) => void;
  onUploadEvidence: (file: File) => void;
  onEvidenceValidationError: (message: string) => void;
  onSubmit: () => void;
  highlighted?: boolean;
  elementId?: string;
};

const MAX_REPORT_EVIDENCE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_REPORT_EVIDENCE_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type ReportEvidenceUploadCardProps = {
  isUploaded: boolean;
  isUploading: boolean;
  uploadedFileName: string;
  previewUrl: string | null;
  onUploadEvidence: (file: File) => void;
  onUploadValidationError: (message: string) => void;
};

function ReportEvidenceUploadCard({
  isUploaded,
  isUploading,
  uploadedFileName,
  previewUrl,
  onUploadEvidence,
  onUploadValidationError,
}: ReportEvidenceUploadCardProps) {
  const inputId = useId();

  return (
    <div className="document-upload-card">
      <div className="document-upload-card-copy">
        <strong>Evidencia del reporte</strong>
        <p>
          Adjunta una imagen o PDF legible para respaldar el caso. Se conservara junto al
          reporte para su revision administrativa.
        </p>
      </div>
      <div className="document-upload-card-actions">
        <StatusPill
          label={isUploaded ? 'Evidencia cargada' : 'Opcional'}
          tone={isUploaded ? 'success' : 'neutral'}
        />

        <div className="document-upload-trigger-row">
          <label
            className={[
              'button',
              'button-secondary',
              'document-upload-trigger',
              isUploading ? 'document-upload-trigger-disabled' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            htmlFor={!isUploading ? inputId : undefined}
            onClick={() => {
              if (!isUploading) {
                suppressAuthSessionSync();
              }
            }}
          >
            {isUploading ? 'Subiendo...' : isUploaded ? 'Cambiar archivo' : 'Seleccionar archivo'}
          </label>
        </div>

        <input
          accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
          className="sr-only"
          disabled={isUploading}
          id={inputId}
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];

            if (!selectedFile) {
              return;
            }

            if (!ALLOWED_REPORT_EVIDENCE_MIME_TYPES.has(selectedFile.type)) {
              onUploadValidationError(
                'La evidencia debe estar en formato PDF, JPG, PNG o WEBP.',
              );
              event.target.value = '';
              return;
            }

            if (selectedFile.size > MAX_REPORT_EVIDENCE_SIZE_BYTES) {
              onUploadValidationError('La evidencia no puede superar los 8 MB.');
              event.target.value = '';
              return;
            }

            onUploadEvidence(selectedFile);
            event.target.value = '';
          }}
          type="file"
        />

        {uploadedFileName ? (
          <p className="form-helper compact-helper">Archivo actual: {uploadedFileName}</p>
        ) : null}

        {previewUrl ? (
          <div className="document-upload-preview">
            <img
              alt="Previsualizacion de evidencia"
              className="document-upload-preview-image"
              src={previewUrl}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}

export function ReportOpportunityCard({
  opportunity,
  value,
  isSubmitting,
  isUploadingEvidence,
  onChange,
  onUploadEvidence,
  onEvidenceValidationError,
  onSubmit,
  highlighted = false,
  elementId,
}: ReportOpportunityCardProps) {
  return (
    <div
      className={['list-card', highlighted ? 'closure-focus-card' : null]
        .filter(Boolean)
        .join(' ')}
      id={elementId}
    >
      <div className="list-card-header">
        <strong>{opportunity.reportedFullName}</strong>
        <div className="button-row">
          <span className="topbar-badge">{opportunity.directionLabel}</span>
          <StatusPill label={opportunity.incidentLabel} tone={opportunity.incidentTone} />
        </div>
      </div>

      <p className="panel-text">
        Viaje: {opportunity.tripOriginLabel} -&gt; {opportunity.tripDestinationLabel}
      </p>
      <p className="panel-text">Salida: {formatDateTime(opportunity.tripDepartureAt)}</p>
      <p className="form-helper compact-helper">{opportunity.incidentSummary}</p>
      {opportunity.tripClosureNote ? (
        <div className="audit-note-banner audit-note-banner-muted">
          <span>Nota de cierre operativo</span>
          <p>{opportunity.tripClosureNote}</p>
        </div>
      ) : null}
      <p className="form-helper compact-helper">
        Disponible hasta {formatTripClosureDeadline(opportunity.windowClosesAt)}.
      </p>

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

      <ReportEvidenceUploadCard
        isUploaded={Boolean(value.evidenceFileKey)}
        isUploading={isUploadingEvidence}
        onUploadEvidence={onUploadEvidence}
        onUploadValidationError={onEvidenceValidationError}
        previewUrl={value.evidencePreviewUrl}
        uploadedFileName={value.evidenceFileName}
      />

      <div className="button-row">
        <Button disabled={isSubmitting} onClick={onSubmit} variant="secondary">
          Registrar reporte
        </Button>
      </div>
    </div>
  );
}
