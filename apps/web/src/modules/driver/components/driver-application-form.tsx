import { DriverVerificationStatus } from '@saferidepro/shared-types';

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
    licenseNumber: string;
    licenseExpiresAt: string;
    identityDocumentFileKey: string;
    licenseDocumentFileKey: string;
  };
  onChange: (
    field:
      | 'licenseTypeId'
      | 'licenseNumber'
      | 'licenseExpiresAt'
      | 'identityDocumentFileKey'
      | 'licenseDocumentFileKey',
    value: string,
  ) => void;
  onDocumentValidationError: (message: string) => void;
  onUploadDocument: (documentType: DriverDocumentType, file: File) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

type DocumentUploadCardProps = {
  documentType: DriverDocumentType;
  title: string;
  description: string;
  isUploaded: boolean;
  isUploading: boolean;
  uploadedFileName?: string | null;
  previewUrl?: string | null;
  onUploadValidationError: (message: string) => void;
  onUploadDocument: (documentType: DriverDocumentType, file: File) => void;
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
  uploadedFileName,
  previewUrl,
  onUploadValidationError,
  onUploadDocument,
}: DocumentUploadCardProps) {
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
        {uploadedFileName ? (
          <p className="document-upload-file-name">{uploadedFileName}</p>
        ) : null}
        <label className="field-label document-upload-input-label">
          Seleccionar archivo
        </label>
        <input
          accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
          className="document-upload-input"
          disabled={isUploading}
          onClick={() => suppressAuthSessionSync()}
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
        {isUploading ? (
          <p className="field-hint">Subiendo archivo...</p>
        ) : null}
        {previewUrl ? (
          <div className="document-upload-preview">
            <img
              alt={`Previsualizacion de ${title.toLowerCase()}`}
              className="document-upload-preview-image"
              src={previewUrl}
            />
          </div>
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
  onSubmit,
}: DriverApplicationFormProps) {
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
  const trimmedLicenseNumber = values.licenseNumber.trim();
  const licenseExpirationDate = values.licenseExpiresAt
    ? new Date(values.licenseExpiresAt)
    : null;

  if (!values.licenseTypeId) {
    validationIssues.push('Selecciona un tipo de licencia antes de enviar la solicitud.');
  }

  if (trimmedLicenseNumber.length < 5) {
    validationIssues.push('Ingresa un numero de licencia valido y suficientemente completo.');
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

      <form className="form-stack" onSubmit={onSubmit}>
        <div className="form-grid form-grid-2">
          <SelectField
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

          <InputField
            label="Numero de licencia"
            onChange={(event) => onChange('licenseNumber', event.target.value)}
            placeholder="Ejemplo: X1234567"
            required
            value={values.licenseNumber}
          />
        </div>

        <InputField
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
            isUploaded={Boolean(values.identityDocumentFileKey)}
            isUploading={isUploadingIdentityDocument}
            onUploadValidationError={onDocumentValidationError}
            onUploadDocument={onUploadDocument}
            previewUrl={identityDocumentPreviewUrl}
            uploadedFileName={identityDocumentFileName}
            title="Documento de identidad"
          />
          <DocumentUploadCard
            description="Carga una imagen o PDF legible de tu licencia vigente."
            documentType="license"
            isUploaded={Boolean(values.licenseDocumentFileKey)}
            isUploading={isUploadingLicenseDocument}
            onUploadValidationError={onDocumentValidationError}
            onUploadDocument={onUploadDocument}
            previewUrl={licenseDocumentPreviewUrl}
            uploadedFileName={licenseDocumentFileName}
            title="Documento de licencia"
          />
        </div>

        {documentErrorMessage ? <div className="form-error">{documentErrorMessage}</div> : null}
        {documentSuccessMessage ? <div className="form-success">{documentSuccessMessage}</div> : null}

        {validationIssues.length ? (
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

        <Button disabled={!canSubmit} type="submit">
          {isSubmitting ? 'Enviando...' : submitLabel}
        </Button>
      </form>
    </article>
  );
}
