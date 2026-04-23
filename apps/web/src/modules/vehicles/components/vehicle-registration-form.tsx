import { LuggagePolicy, VehicleType } from '@saferidepro/shared-types';
import { useId } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { suppressAuthSessionSync } from '../../auth/lib/auth-sync-guard';
import type {
  VehicleBrandCatalogItem,
  VehicleModelCatalogItem,
} from '../types/vehicle';
import {
  getLuggagePolicyLabel,
  getVehicleTypeLabel,
} from '../lib/vehicle-labels';

type VehicleFormValues = {
  vehicleType: VehicleType;
  brandId: string;
  customBrandName: string;
  modelId: string;
  customModelName: string;
  year: string;
  color: string;
  plate: string;
  seatCount: string;
  luggagePolicy: LuggagePolicy;
  registrationDocumentFileKey: string;
};

type VehicleRegistrationFormProps = {
  values: VehicleFormValues;
  brands: VehicleBrandCatalogItem[];
  models: VehicleModelCatalogItem[];
  isManualBrand: boolean;
  isManualModel: boolean;
  isSubmitting: boolean;
  isDisabled: boolean;
  isEditing: boolean;
  isUploadingRegistrationDocument: boolean;
  isOpeningRegistrationDocumentPreview: boolean;
  isDownloadingRegistrationDocument: boolean;
  editingVehicleName?: string | null;
  registrationDocumentFileName?: string | null;
  registrationDocumentPreviewUrl?: string | null;
  errorMessage: string | null;
  successMessage: string | null;
  documentErrorMessage: string | null;
  documentSuccessMessage: string | null;
  onToggleManualBrand: () => void;
  onToggleManualModel: () => void;
  onCancelEdit: () => void;
  onUploadValidationError: (message: string) => void;
  onUploadRegistrationDocument: (file: File) => void;
  onPreviewRegistrationDocument: () => void;
  onDownloadRegistrationDocument: () => void;
  onChange: (field: keyof VehicleFormValues, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

const VEHICLE_TYPE_OPTIONS = [
  VehicleType.Motorcycle,
  VehicleType.Car,
  VehicleType.PickupTruck,
] as const;
const LUGGAGE_OPTIONS = [
  LuggagePolicy.NotAllowed,
  LuggagePolicy.SmallOnly,
  LuggagePolicy.UpToMedium,
  LuggagePolicy.LargeAllowed,
] as const;
const MAX_VEHICLE_DOCUMENT_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_VEHICLE_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type RegistrationDocumentUploadCardProps = {
  isUploaded: boolean;
  isUploading: boolean;
  isDownloading: boolean;
  isOpeningPreview: boolean;
  isLocked: boolean;
  uploadedFileName?: string | null;
  previewUrl?: string | null;
  onUploadValidationError: (message: string) => void;
  onUploadRegistrationDocument: (file: File) => void;
  onPreviewRegistrationDocument: () => void;
  onDownloadRegistrationDocument: () => void;
};

function RegistrationDocumentUploadCard({
  isUploaded,
  isUploading,
  isDownloading,
  isOpeningPreview,
  isLocked,
  uploadedFileName,
  previewUrl,
  onUploadValidationError,
  onUploadRegistrationDocument,
  onPreviewRegistrationDocument,
  onDownloadRegistrationDocument,
}: RegistrationDocumentUploadCardProps) {
  const inputId = useId();
  const canInteract = !isLocked && !isUploading;

  return (
    <div className="document-upload-card">
      <div className="document-upload-card-copy">
        <strong>Documento de matricula</strong>
        <p>
          Carga una imagen o PDF legible del respaldo vehicular. Se usara como evidencia del
          registro del vehiculo.
        </p>
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

            if (!ALLOWED_VEHICLE_DOCUMENT_MIME_TYPES.has(selectedFile.type)) {
              onUploadValidationError(
                'El documento debe estar en formato PDF, JPG, PNG o WEBP.',
              );
              event.target.value = '';
              return;
            }

            if (selectedFile.size > MAX_VEHICLE_DOCUMENT_SIZE_BYTES) {
              onUploadValidationError('El documento no puede superar los 8 MB.');
              event.target.value = '';
              return;
            }

            onUploadRegistrationDocument(selectedFile);
            event.target.value = '';
          }}
          type="file"
        />

        <div className="button-row document-upload-action-row">
          <Button
            disabled={!isUploaded || isOpeningPreview}
            onClick={onPreviewRegistrationDocument}
            variant="secondary"
          >
            {isOpeningPreview ? 'Abriendo...' : 'Ver documento'}
          </Button>
          <Button
            disabled={!isUploaded || isDownloading}
            onClick={onDownloadRegistrationDocument}
            variant="ghost"
          >
            {isDownloading ? 'Descargando...' : 'Descargar'}
          </Button>
        </div>

        {previewUrl ? (
          <button
            className="document-upload-preview-button"
            onClick={onPreviewRegistrationDocument}
            type="button"
          >
            <div className="document-upload-preview">
              <img
                alt="Previsualizacion del documento de matricula"
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

export function VehicleRegistrationForm({
  values,
  brands,
  models,
  isManualBrand,
  isManualModel,
  isSubmitting,
  isDisabled,
  isEditing,
  isUploadingRegistrationDocument,
  isOpeningRegistrationDocumentPreview,
  isDownloadingRegistrationDocument,
  editingVehicleName,
  registrationDocumentFileName,
  registrationDocumentPreviewUrl,
  errorMessage,
  successMessage,
  documentErrorMessage,
  documentSuccessMessage,
  onToggleManualBrand,
  onToggleManualModel,
  onCancelEdit,
  onUploadValidationError,
  onUploadRegistrationDocument,
  onPreviewRegistrationDocument,
  onDownloadRegistrationDocument,
  onChange,
  onSubmit,
}: VehicleRegistrationFormProps) {
  const currentYear = new Date().getFullYear();
  const yearValue = Number.parseInt(values.year, 10);
  const seatCountValue = Number.parseInt(values.seatCount, 10);
  const plateValue = values.plate.trim();
  const customBrandName = values.customBrandName.trim();
  const customModelName = values.customModelName.trim();
  const colorValue = values.color.trim();
  const validationIssues: string[] = [];
  const validationWarnings: string[] = [];

  if (isManualBrand ? !customBrandName : !values.brandId) {
    validationIssues.push('Debes indicar una marca valida para gestionar el vehiculo.');
  }

  if (isManualModel ? !customModelName : !values.modelId) {
    validationIssues.push('Debes indicar un modelo valido para gestionar el vehiculo.');
  }

  if (Number.isNaN(yearValue) || yearValue < 1990 || yearValue > currentYear + 1) {
    validationIssues.push(`El anio debe estar entre 1990 y ${currentYear + 1}.`);
  }

  if (!colorValue) {
    validationIssues.push('Debes indicar el color principal del vehiculo.');
  }

  if (plateValue.length < 6) {
    validationIssues.push('Ingresa una placa valida de al menos 6 caracteres.');
  }

  if (Number.isNaN(seatCountValue) || seatCountValue < 1) {
    validationIssues.push('La capacidad del vehiculo debe ser de al menos 1 pasajero.');
  }

  if (values.vehicleType === VehicleType.Motorcycle && seatCountValue !== 1) {
    validationIssues.push('La motocicleta solo puede registrarse con 1 cupo operativo.');
  }

  if (values.vehicleType === VehicleType.Car && seatCountValue > 4) {
    validationIssues.push('El automovil no puede exceder 4 cupos operativos en esta etapa.');
  }

  if (values.vehicleType === VehicleType.PickupTruck && seatCountValue > 5) {
    validationIssues.push('La camioneta no puede exceder 5 cupos operativos en esta etapa.');
  }

  if (!values.registrationDocumentFileKey.trim()) {
    validationIssues.push('Debes cargar el documento de matricula antes de guardar el vehiculo.');
  }

  if (!isManualModel && values.brandId && models.length === 0) {
    validationWarnings.push(
      'No hay modelos disponibles en el catalogo para esta combinacion de tipo y marca. Puedes ingresar el modelo manualmente.',
    );
  }

  const canSubmit = !isSubmitting && !isDisabled && validationIssues.length === 0;

  return (
    <article className="panel panel-stack">
      <div className="panel-header-row">
        <div>
          <h2 className="panel-title">
            {isEditing ? 'Editar vehiculo' : 'Registrar vehiculo'}
          </h2>
          <p className="panel-text">{isEditing ? 'Actualiza y guarda.' : 'Completa y registra.'}</p>
        </div>
        {isEditing ? (
          <Button onClick={onCancelEdit} variant="secondary">
            Cancelar edicion
          </Button>
        ) : null}
      </div>

      {isEditing && editingVehicleName ? (
        <div className="form-helper form-helper-strong">
          Editando: <strong>{editingVehicleName}</strong>
        </div>
      ) : null}

      <form className="form-stack" onSubmit={onSubmit}>
        <div className="form-grid form-grid-2">
          <SelectField
            disabled={isDisabled}
            label="Tipo de vehiculo"
            onChange={(event) => onChange('vehicleType', event.target.value)}
            required
            value={values.vehicleType}
          >
            {VEHICLE_TYPE_OPTIONS.map((vehicleType) => (
              <option key={vehicleType} value={vehicleType}>
                {getVehicleTypeLabel(vehicleType)}
              </option>
            ))}
          </SelectField>

          <InputField
            disabled={isDisabled}
            label="Anio"
            onChange={(event) => onChange('year', event.target.value)}
            placeholder="2024"
            required
            type="number"
            value={values.year}
          />
        </div>

        <div className="form-grid form-grid-2">
          <div className="field field-panel">
            <div className="field-inline-header">
              <span className="field-label">Marca</span>
              <button className="text-action" onClick={onToggleManualBrand} type="button">
                {isManualBrand ? 'Usar catalogo' : 'Ingresar manualmente'}
              </button>
            </div>
            {isManualBrand ? (
              <input
                className="input"
                disabled={isDisabled}
                onChange={(event) => onChange('customBrandName', event.target.value)}
                placeholder="Ejemplo: Kia"
                required
                value={values.customBrandName}
              />
            ) : (
              <select
                className="input"
                disabled={isDisabled}
                onChange={(event) => onChange('brandId', event.target.value)}
                required
                value={values.brandId}
              >
                <option value="">Selecciona una marca</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="field field-panel">
            <div className="field-inline-header">
              <span className="field-label">Modelo</span>
              <button className="text-action" onClick={onToggleManualModel} type="button">
                {isManualModel ? 'Usar catalogo' : 'Ingresar manualmente'}
              </button>
            </div>
            {isManualModel ? (
              <input
                className="input"
                disabled={isDisabled}
                onChange={(event) => onChange('customModelName', event.target.value)}
                placeholder="Ejemplo: Rio"
                required
                value={values.customModelName}
              />
            ) : (
              <select
                className="input"
                disabled={isDisabled}
                onChange={(event) => onChange('modelId', event.target.value)}
                required
                value={values.modelId}
              >
                <option value="">Selecciona un modelo</option>
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="form-grid form-grid-3">
          <InputField
            disabled={isDisabled}
            label="Color"
            onChange={(event) => onChange('color', event.target.value)}
            placeholder="Rojo"
            required
            value={values.color}
          />
          <InputField
            disabled={isDisabled}
            label="Placa"
            onChange={(event) => onChange('plate', event.target.value.toUpperCase())}
            placeholder="ABC1234"
            required
            value={values.plate}
          />
          <InputField
            disabled={isDisabled}
            label="Capacidad"
            onChange={(event) => onChange('seatCount', event.target.value)}
            placeholder="4"
            required
            type="number"
            value={values.seatCount}
          />
        </div>

        <div className="form-grid form-grid-2">
          <SelectField
            disabled={isDisabled}
            label="Politica de equipaje"
            onChange={(event) => onChange('luggagePolicy', event.target.value)}
            required
            value={values.luggagePolicy}
          >
            {LUGGAGE_OPTIONS.map((luggagePolicy) => (
              <option key={luggagePolicy} value={luggagePolicy}>
                {getLuggagePolicyLabel(luggagePolicy)}
              </option>
            ))}
          </SelectField>
        </div>

        <RegistrationDocumentUploadCard
          isDownloading={isDownloadingRegistrationDocument}
          isLocked={isDisabled}
          isOpeningPreview={isOpeningRegistrationDocumentPreview}
          isUploaded={Boolean(values.registrationDocumentFileKey)}
          isUploading={isUploadingRegistrationDocument}
          onDownloadRegistrationDocument={onDownloadRegistrationDocument}
          onPreviewRegistrationDocument={onPreviewRegistrationDocument}
          onUploadRegistrationDocument={onUploadRegistrationDocument}
          onUploadValidationError={onUploadValidationError}
          previewUrl={registrationDocumentPreviewUrl}
          uploadedFileName={registrationDocumentFileName}
        />

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

        {validationWarnings.length ? (
          <div className="validation-card validation-card-warning">
            <strong>Advertencias utiles:</strong>
            <ul className="validation-list">
              {validationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {documentErrorMessage ? <div className="form-error">{documentErrorMessage}</div> : null}
        {documentSuccessMessage ? <div className="form-success">{documentSuccessMessage}</div> : null}
        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        {successMessage ? <div className="form-success">{successMessage}</div> : null}

        <div className="button-row">
          <Button disabled={!canSubmit} type="submit">
            {isSubmitting
              ? isEditing
                ? 'Actualizando...'
                : 'Registrando...'
              : isEditing
                ? 'Guardar cambios'
                : 'Registrar vehiculo'}
          </Button>
          {isEditing ? (
            <Button disabled={isSubmitting} onClick={onCancelEdit} variant="ghost">
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
    </article>
  );
}
