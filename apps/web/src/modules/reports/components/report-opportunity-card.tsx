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
} from '../lib/report-labels';
import styles from './report-opportunity-card.module.css';

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
    <div className={styles.uploadBlock}>
      <div>
        <strong>Evidencia del reporte</strong>
      </div>
      <div className={styles.uploadActions}>
        <StatusPill
          label={isUploaded ? 'Evidencia cargada' : 'Opcional'}
          tone={isUploaded ? 'success' : 'neutral'}
        />

        <div className={styles.uploadActions}>
          <label
            className={[
              styles.uploadLabel,
              isUploading ? styles.uploadLabelDisabled : '',
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
          className={styles.uploadInput}
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
          <p className={styles.uploadHint}>Archivo actual: {uploadedFileName}</p>
        ) : null}

        {previewUrl ? (
          <div className={styles.preview}>
            <img alt="Previsualizacion de evidencia" src={previewUrl} />
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
      className={[styles.card, highlighted ? styles.highlighted : null]
        .filter(Boolean)
        .join(' ')}
      id={elementId}
    >
      <div className={styles.header}>
        <div className={styles.identity}>
          <strong className={styles.title}>{opportunity.reportedFullName}</strong>
          <p className={styles.meta}>
            {opportunity.tripOriginLabel} -&gt; {opportunity.tripDestinationLabel}
          </p>
          <p className={styles.meta}>Salida: {formatDateTime(opportunity.tripDepartureAt)}</p>
        </div>
        <div className={styles.badges}>
          <span className="topbar-badge">{opportunity.directionLabel}</span>
          <StatusPill label={opportunity.incidentLabel} tone={opportunity.incidentTone} />
        </div>
      </div>

      <p className={styles.incidentSummary}>{opportunity.incidentSummary}</p>
      {opportunity.tripClosureNote ? (
        <div className={styles.closureNote}>
          <span>Nota de cierre operativo</span>
          <p>{opportunity.tripClosureNote}</p>
        </div>
      ) : null}
      <p className={styles.deadline}>Hasta {formatTripClosureDeadline(opportunity.windowClosesAt)}</p>

      <div className={styles.grid}>
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
      </div>

      <TextareaField
        label="Descripcion"
        onChange={(event) => onChange('description', event.target.value)}
        placeholder="Describe lo ocurrido"
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

      <div className={styles.actions}>
        <Button disabled={isSubmitting} onClick={onSubmit} variant="secondary">
          Registrar
        </Button>
      </div>
    </div>
  );
}
