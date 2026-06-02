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
  onClose: () => void;
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
      <div className={styles.uploadHeader}>
        <strong>Evidencia del reporte</strong>
        <StatusPill
          label={isUploaded ? 'Evidencia cargada' : 'Opcional'}
          tone={isUploaded ? 'success' : 'neutral'}
        />
      </div>
      
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
          <span className={styles.uploadIcon}>📁</span>
          {isUploading ? 'Subiendo...' : isUploaded ? 'Cambiar archivo' : 'Seleccionar archivo o arrastrar'}
        </label>
        <p className={styles.uploadHintSmall}>Admite PDF, JPG, PNG o WEBP (máximo 8 MB)</p>

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
          <p className={styles.uploadHint}>Archivo actual: <strong>{uploadedFileName}</strong></p>
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
  onClose,
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
      <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Cerrar">
        &times;
      </button>

      <div className={styles.warningBanner}>
        <div className={styles.bannerIcon}>⚠️</div>
        <div className={styles.bannerText}>
          <strong>Reporte de Incidente</strong>
          <p>La información enviada será revisada por el equipo de seguridad de SafeRidePro.</p>
        </div>
      </div>

      <div className={styles.header}>
        <div className={styles.identity}>
          <p className={styles.meta}>Reportando a</p>
          <strong className={styles.title}>{opportunity.reportedFullName}</strong>
        </div>
        <div className={styles.badges}>
          <span className="topbar-badge">{opportunity.directionLabel}</span>
          <StatusPill label={opportunity.incidentLabel} tone={opportunity.incidentTone} />
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

      <div className={styles.incidentSummaryBox}>
        <p className={styles.incidentSummary}>{opportunity.incidentSummary}</p>
        {opportunity.tripClosureNote ? (
          <div className={styles.closureNote}>
            <span>Nota de cierre operativo</span>
            <p>{opportunity.tripClosureNote}</p>
          </div>
        ) : null}
      </div>

      <div className={styles.formGrid}>
        <div className={styles.reasonField}>
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

        <div className={styles.descriptionField}>
          <TextareaField
            label="Detalles del reporte"
            onChange={(event) => onChange('description', event.target.value)}
            placeholder="Describe lo ocurrido con el mayor detalle posible"
            rows={4}
            value={value.description}
          />
        </div>
      </div>

      <div className={styles.uploadDropzoneWrapper}>
        <ReportEvidenceUploadCard
          isUploaded={Boolean(value.evidenceFileKey)}
          isUploading={isUploadingEvidence}
          onUploadEvidence={onUploadEvidence}
          onUploadValidationError={onEvidenceValidationError}
          previewUrl={value.evidencePreviewUrl}
          uploadedFileName={value.evidenceFileName}
        />
      </div>

      <div className={styles.footerRow}>
        <p className={styles.deadline}>Cierra {formatTripClosureDeadline(opportunity.windowClosesAt)}</p>
        <div className={styles.actions}>
          <Button disabled={isSubmitting || !value.reason || !value.description?.trim()} onClick={onSubmit} className={styles.submitButton}>
            {isSubmitting ? 'Enviando...' : 'Enviar Reporte Oficial'}
          </Button>
        </div>
      </div>
    </div>
  );
}
