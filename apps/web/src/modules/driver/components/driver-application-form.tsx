import { DriverVerificationStatus } from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
import type { LicenseTypeCatalogItem } from '../types/driver';
import { getDriverStatusLabel, getDriverStatusTone } from '../lib/driver-status';

type DriverApplicationFormProps = {
  licenseTypes: LicenseTypeCatalogItem[];
  currentStatus: DriverVerificationStatus;
  currentReviewNotes?: string | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  values: {
    licenseTypeId: string;
    licenseNumber: string;
    licenseExpiresAt: string;
    identityDocumentFileKey: string;
    licenseDocumentFileKey: string;
  };
  onChange: (field: 'licenseTypeId' | 'licenseNumber' | 'licenseExpiresAt' | 'identityDocumentFileKey' | 'licenseDocumentFileKey', value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function DriverApplicationForm({
  licenseTypes,
  currentStatus,
  currentReviewNotes,
  isSubmitting,
  errorMessage,
  successMessage,
  values,
  onChange,
  onSubmit,
}: DriverApplicationFormProps) {
  const submitLabel = currentStatus === DriverVerificationStatus.Rejected
    || currentStatus === DriverVerificationStatus.Suspended
    ? 'Reenviar solicitud'
    : currentStatus === DriverVerificationStatus.PendingVerification
      ? 'Actualizar solicitud'
      : 'Enviar solicitud';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validationIssues: string[] = [];
  const validationWarnings: string[] = [];
  const trimmedLicenseNumber = values.licenseNumber.trim();
  const licenseExpirationDate = values.licenseExpiresAt ? new Date(values.licenseExpiresAt) : null;

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

  if (!values.identityDocumentFileKey.trim() || !values.licenseDocumentFileKey.trim()) {
    validationWarnings.push(
      'La solicitud puede enviarse sin ambos respaldos, pero no podra aprobarse administrativamente hasta registrarlos.',
    );
  }

  const canSubmit = !isSubmitting && validationIssues.length === 0;

  return (
    <article className="panel panel-stack">
      <div className="panel-header-row">
        <div>
          <h2 className="panel-title">Solicitud de conductor</h2>
          <p className="panel-text">
            Completa tu licencia y los archivos de respaldo necesarios para habilitar el registro de vehiculos y viajes.
          </p>
        </div>
        <StatusPill label={getDriverStatusLabel(currentStatus)} tone={getDriverStatusTone(currentStatus)} />
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

        <div className="form-grid form-grid-2">
          <InputField
            label="Fecha de expiracion"
            onChange={(event) => onChange('licenseExpiresAt', event.target.value)}
            required
            type="date"
            value={values.licenseExpiresAt}
          />

          <InputField
            hint="Necesaria para una aprobacion administrativa completa. Puedes usar una clave de prueba."
            label="Clave del documento de identidad"
            onChange={(event) => onChange('identityDocumentFileKey', event.target.value)}
            placeholder="identity-doc-key"
            value={values.identityDocumentFileKey}
          />
        </div>

        <InputField
          hint="Necesaria para una aprobacion administrativa completa. Puedes usar una clave de prueba."
          label="Clave del documento de licencia"
          onChange={(event) => onChange('licenseDocumentFileKey', event.target.value)}
          placeholder="license-doc-key"
          value={values.licenseDocumentFileKey}
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
            <strong>Advertencias utiles para la demo:</strong>
            <ul className="validation-list">
              {validationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
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

