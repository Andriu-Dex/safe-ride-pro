'use client';

import { DriverVerificationStatus } from '@saferidepro/shared-types';
import { useId } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { suppressAuthSessionSync } from '../../auth/lib/auth-sync-guard';
import { getDriverStatusLabel, getDriverStatusTone } from '../lib/driver-status';
import type { DriverDocumentType, LicenseTypeCatalogItem } from '../types/driver';

type DriverApplicationFormProps = {
  licenseTypes: LicenseTypeCatalogItem[];
  currentStatus: DriverVerificationStatus;
  currentReviewNotes?: string | null;
  isSubmitting: boolean;
  isUploadingIdentityDocument: boolean;
  isUploadingLicenseDocument: boolean;
  isDownloadingIdentityDocument: boolean;
  isDownloadingLicenseDocument: boolean;
  isOpeningIdentityPreview: boolean;
  isOpeningLicensePreview: boolean;
  identityDocumentFileName?: string | null;
  identityDocumentPreviewUrl?: string | null;
  licenseDocumentFileName?: string | null;
  licenseDocumentPreviewUrl?: string | null;
  errorMessage: string | null;
  successMessage: string | null;
  documentErrorMessage: string | null;
  documentSuccessMessage: string | null;
  values: {
    licenseTypeId: string;
    licenseExpiresAt: string;
    identityDocumentFileKey: string;
    licenseDocumentFileKey: string;
  };
  onChange: (
    field:
      | 'licenseTypeId'
      | 'licenseExpiresAt'
      | 'identityDocumentFileKey'
      | 'licenseDocumentFileKey',
    value: string,
  ) => void;
  onDocumentValidationError: (message: string) => void;
  onUploadDocument: (documentType: DriverDocumentType, file: File) => void;
  onPreviewDocument: (documentType: DriverDocumentType) => void;
  onDownloadDocument: (documentType: DriverDocumentType) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

type DocumentUploadCardProps = {
  documentType: DriverDocumentType;
  title: string;
  description: string;
  isUploaded: boolean;
  isUploading: boolean;
  isDownloading: boolean;
  isOpeningPreview: boolean;
  isLocked: boolean;
  uploadedFileName?: string | null;
  previewUrl?: string | null;
  onUploadValidationError: (message: string) => void;
  onUploadDocument: (documentType: DriverDocumentType, file: File) => void;
  onPreviewDocument: (documentType: DriverDocumentType) => void;
  onDownloadDocument: (documentType: DriverDocumentType) => void;
};

const MAX_DRIVER_DOCUMENT_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_DRIVER_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function DocumentUploadCard({
  documentType,
  title,
  description,
  isUploaded,
  isUploading,
  isDownloading,
  isOpeningPreview,
  isLocked,
  uploadedFileName,
  previewUrl,
  onUploadValidationError,
  onUploadDocument,
  onPreviewDocument,
  onDownloadDocument,
}: DocumentUploadCardProps) {
  const inputId = `driver-document-${documentType.toLowerCase()}`;
  const canInteract = !isLocked && !isUploading;

  return (
    <div className="document-upload-card">
      <div className="document-upload-card-copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="document-upload-card-actions">
        <StatusPill
          label={isUploaded ? 'Documento cargado' : 'Pendiente'}
          tone={isUploaded ? 'success' : 'warning'}
        />

        <div className="document-upload-trigger-row">
          <label
            className={[
              'button',
              'button-secondary',
              'document-upload-trigger',
              canInteract ? '' : 'document-upload-trigger-disabled',
            ]
              .filter(Boolean)
              .join(' ')}
            htmlFor={canInteract ? inputId : undefined}
            onClick={() => {
              if (canInteract) {
                suppressAuthSessionSync();
              }
            }}
          >
            {isUploading ? 'Subiendo...' : 'Seleccionar archivo'}
          </label>
        </div>

        <input
          accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
          className="sr-only"
          disabled={!canInteract}
          id={inputId}
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];

            if (!selectedFile) {
              return;
            }

            if (!ALLOWED_DRIVER_DOCUMENT_MIME_TYPES.has(selectedFile.type)) {
              onUploadValidationError(
                'El documento debe estar en formato PDF, JPG, PNG o WEBP.',
              );
              event.target.value = '';
              return;
            }

            if (selectedFile.size > MAX_DRIVER_DOCUMENT_SIZE_BYTES) {
              onUploadValidationError('El documento no puede superar los 8 MB.');
              event.target.value = '';
              return;
            }

            onUploadDocument(documentType, selectedFile);
            event.target.value = '';
          }}
          type="file"
        />

        <div className="button-row document-upload-action-row">
          <Button
            disabled={!isUploaded || isOpeningPreview}
            onClick={() => onPreviewDocument(documentType)}
            variant="secondary"
          >
            {isOpeningPreview ? 'Abriendo...' : 'Ver documento'}
          </Button>
          <Button
            disabled={!isUploaded || isDownloading}
            onClick={() => onDownloadDocument(documentType)}
            variant="ghost"
          >
            {isDownloading ? 'Descargando...' : 'Descargar'}
          </Button>
        </div>

        {previewUrl ? (
          <button
            className="document-upload-preview-button"
            onClick={() => onPreviewDocument(documentType)}
            type="button"
          >
            <div className="document-upload-preview">
              <img
                alt={`Previsualizacion de ${title.toLowerCase()}`}
                className="document-upload-preview-image"
                src={previewUrl}
              />
            </div>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function DriverApplicationForm({
  licenseTypes,
  currentStatus,
  currentReviewNotes,
  isSubmitting,
  isUploadingIdentityDocument,
  isUploadingLicenseDocument,
  isDownloadingIdentityDocument,
  isDownloadingLicenseDocument,
  isOpeningIdentityPreview,
  isOpeningLicensePreview,
  identityDocumentFileName,
  identityDocumentPreviewUrl,
  licenseDocumentFileName,
  licenseDocumentPreviewUrl,
  errorMessage,
  successMessage,
  documentErrorMessage,
  documentSuccessMessage,
  values,
  onChange,
  onDocumentValidationError,
  onUploadDocument,
  onPreviewDocument,
  onDownloadDocument,
  onSubmit,
}: DriverApplicationFormProps) {
  const isApproved = currentStatus === DriverVerificationStatus.Approved;
  const submitLabel =
    currentStatus === DriverVerificationStatus.Rejected ||
    currentStatus === DriverVerificationStatus.Suspended
      ? 'Reenviar solicitud'
      : currentStatus === DriverVerificationStatus.PendingVerification
        ? 'Actualizar solicitud'
        : 'Enviar solicitud';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validationIssues: string[] = [];
  const licenseExpirationDate = values.licenseExpiresAt
    ? new Date(values.licenseExpiresAt)
    : null;

  if (!values.licenseTypeId) {
    validationIssues.push('Selecciona un tipo de licencia antes de enviar la solicitud.');
  }

  if (!values.licenseExpiresAt) {
    validationIssues.push('Debes indicar la fecha de expiracion de la licencia.');
  } else if (licenseExpirationDate && licenseExpirationDate < today) {
    validationIssues.push('La licencia ya esta vencida. Debes registrar una fecha vigente para continuar.');
  }

  if (!values.identityDocumentFileKey.trim()) {
    validationIssues.push('Debes cargar el documento de identidad antes de enviar la solicitud.');
  }

  if (!values.licenseDocumentFileKey.trim()) {
    validationIssues.push('Debes cargar el documento de licencia antes de enviar la solicitud.');
  }

  const canSubmit =
    !isApproved &&
    !isSubmitting &&
    !isUploadingIdentityDocument &&
    !isUploadingLicenseDocument &&
    validationIssues.length === 0;

  return (
    <article className="panel panel-stack">
      <div className="panel-header-row">
        <div>
          <h2 className="panel-title">Solicitud de conductor</h2>
          <p className="panel-text">
            Completa tu licencia y carga los respaldos requeridos para habilitar el
            registro de vehiculos y viajes.
          </p>
        </div>
        <StatusPill
          label={getDriverStatusLabel(currentStatus)}
          tone={getDriverStatusTone(currentStatus)}
        />
      </div>

      {currentReviewNotes ? (
        <div className="form-helper">
          <strong>Observaciones de revision:</strong> {currentReviewNotes}
        </div>
      ) : null}

      {isApproved ? (
        <div className="form-helper form-helper-strong">
          Tu habilitacion como conductor ya fue aprobada. Puedes revisar y descargar tus
          documentos, pero cualquier actualizacion debe gestionarse con administracion.
        </div>
      ) : null}

      <form className="form-stack" onSubmit={onSubmit}>
        <div className="form-grid form-grid-2">
          <SelectField
            disabled={isApproved}
            label="Tipo de licencia"
            onChange={(event) => onChange('licenseTypeId', event.target.value)}
            required
            value={values.licenseTypeId}
          >
            <option value="">Selecciona una opcion</option>
            {licenseTypes.map((licenseType) => (
              <option key={licenseType.id} value={licenseType.id}>
                {licenseType.code} - {licenseType.name}
              </option>
            ))}
          </SelectField>

        </div>

        <InputField
          disabled={isApproved}
          label="Fecha de expiracion"
          onChange={(event) => onChange('licenseExpiresAt', event.target.value)}
          required
          type="date"
          value={values.licenseExpiresAt}
        />

        <div className="document-upload-grid">
          <DocumentUploadCard
            description="Carga una imagen o PDF legible de tu documento de identidad."
            documentType="identity"
            isDownloading={isDownloadingIdentityDocument}
            isLocked={isApproved}
            isOpeningPreview={isOpeningIdentityPreview}
            isUploaded={Boolean(values.identityDocumentFileKey)}
            isUploading={isUploadingIdentityDocument}
            onDownloadDocument={onDownloadDocument}
            onPreviewDocument={onPreviewDocument}
            onUploadDocument={onUploadDocument}
            onUploadValidationError={onDocumentValidationError}
            previewUrl={identityDocumentPreviewUrl}
            title="Documento de identidad"
            uploadedFileName={identityDocumentFileName}
          />
          <DocumentUploadCard
            description="Carga una imagen o PDF legible de tu licencia vigente."
            documentType="license"
            isDownloading={isDownloadingLicenseDocument}
            isLocked={isApproved}
            isOpeningPreview={isOpeningLicensePreview}
            isUploaded={Boolean(values.licenseDocumentFileKey)}
            isUploading={isUploadingLicenseDocument}
            onDownloadDocument={onDownloadDocument}
            onPreviewDocument={onPreviewDocument}
            onUploadDocument={onUploadDocument}
            onUploadValidationError={onDocumentValidationError}
            previewUrl={licenseDocumentPreviewUrl}
            title="Documento de licencia"
            uploadedFileName={licenseDocumentFileName}
          />
        </div>

        {documentErrorMessage ? <div className="form-error">{documentErrorMessage}</div> : null}
        {documentSuccessMessage ? <div className="form-success">{documentSuccessMessage}</div> : null}

        {!isApproved && validationIssues.length ? (
          <div className="validation-card validation-card-danger">
            <strong>Revisa estos puntos antes de continuar:</strong>
            <ul className="validation-list">
              {validationIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        {successMessage ? <div className="form-success">{successMessage}</div> : null}

        {!isApproved ? (
          <Button disabled={!canSubmit} type="submit">
            {isSubmitting ? 'Enviando...' : submitLabel}
          </Button>
        ) : null}
      </form>
    </article>
  );
}
