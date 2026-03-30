import { LuggagePolicy, VehicleType } from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import type { VehicleBrandCatalogItem, VehicleModelCatalogItem } from '../types/vehicle';
import { getLuggagePolicyLabel, getVehicleTypeLabel } from '../lib/vehicle-labels';

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
  errorMessage: string | null;
  successMessage: string | null;
  onToggleManualBrand: () => void;
  onToggleManualModel: () => void;
  onChange: (field: keyof VehicleFormValues, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

const VEHICLE_TYPE_OPTIONS = [VehicleType.Motorcycle, VehicleType.Car, VehicleType.PickupTruck] as const;
const LUGGAGE_OPTIONS = [
  LuggagePolicy.NotAllowed,
  LuggagePolicy.SmallOnly,
  LuggagePolicy.UpToMedium,
  LuggagePolicy.LargeAllowed,
] as const;

export function VehicleRegistrationForm({
  values,
  brands,
  models,
  isManualBrand,
  isManualModel,
  isSubmitting,
  isDisabled,
  errorMessage,
  successMessage,
  onToggleManualBrand,
  onToggleManualModel,
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
    validationIssues.push('Debes indicar una marca valida para registrar el vehiculo.');
  }

  if (isManualModel ? !customModelName : !values.modelId) {
    validationIssues.push('Debes indicar un modelo valido para registrar el vehiculo.');
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
    validationIssues.push('El automovil no puede exceder 4 cupos operativos en el MVP.');
  }

  if (values.vehicleType === VehicleType.PickupTruck && seatCountValue > 5) {
    validationIssues.push('La camioneta no puede exceder 5 cupos operativos en el MVP.');
  }

  if (!values.registrationDocumentFileKey.trim()) {
    validationWarnings.push(
      'Puedes continuar sin la clave documental, pero registrar la evidencia mejora la trazabilidad de la demo.',
    );
  }

  const canSubmit = !isSubmitting && !isDisabled && validationIssues.length === 0;

  return (
    <article className="panel panel-stack">
      <div>
        <h2 className="panel-title">Registrar vehiculo</h2>
        <p className="panel-text">
          Puedes seleccionar marca y modelo del catalogo o ingresar datos manuales cuando no existan aun en el sistema.
        </p>
      </div>

      <form className="form-stack" onSubmit={onSubmit}>
        <div className="form-grid form-grid-2">
          <SelectField
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
                onChange={(event) => onChange('customBrandName', event.target.value)}
                placeholder="Ejemplo: Kia"
                required
                value={values.customBrandName}
              />
            ) : (
              <select
                className="input"
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
                onChange={(event) => onChange('customModelName', event.target.value)}
                placeholder="Ejemplo: Rio"
                required
                value={values.customModelName}
              />
            ) : (
              <select
                className="input"
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
            label="Color"
            onChange={(event) => onChange('color', event.target.value)}
            placeholder="Rojo"
            required
            value={values.color}
          />
          <InputField
            label="Placa"
            onChange={(event) => onChange('plate', event.target.value.toUpperCase())}
            placeholder="ABC1234"
            required
            value={values.plate}
          />
          <InputField
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

          <InputField
            hint="Opcional por ahora. Aqui podras enlazar la evidencia documental del vehiculo."
            label="Clave del documento de matricula"
            onChange={(event) => onChange('registrationDocumentFileKey', event.target.value)}
            placeholder="vehicle-doc-key"
            value={values.registrationDocumentFileKey}
          />
        </div>

        {validationIssues.length ? (
          <div className="validation-card validation-card-danger">
            <strong>Revisa estos puntos antes de registrar el vehiculo:</strong>
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
          {isSubmitting ? 'Registrando...' : 'Registrar vehiculo'}
        </Button>
      </form>
    </article>
  );
}

