import { TripRouteMode } from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { TextareaField } from '../../../components/ui/textarea-field';
import type { VehicleRecord } from '../../vehicles/types/vehicle';
import { getTripRouteModeLabel } from '../lib/trip-labels';

type TripFormValues = {
  vehicleId: string;
  routeMode: TripRouteMode;
  originLabel: string;
  destinationLabel: string;
  originLatitude: string;
  originLongitude: string;
  destinationLatitude: string;
  destinationLongitude: string;
  departureAt: string;
  estimatedArrivalAt: string;
  seatCount: string;
  basePriceReference: string;
  detourSurchargeReference: string;
  notes: string;
};

type TripCreationFormProps = {
  values: TripFormValues;
  vehicles: VehicleRecord[];
  disabled: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  onChange: (field: keyof TripFormValues, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

const ROUTE_MODES = [TripRouteMode.DirectRoute, TripRouteMode.PlannedDetour] as const;

export function TripCreationForm({
  values,
  vehicles,
  disabled,
  isSubmitting,
  errorMessage,
  successMessage,
  onChange,
  onSubmit,
}: TripCreationFormProps) {
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === values.vehicleId);
  const now = new Date();
  const originLabel = values.originLabel.trim();
  const destinationLabel = values.destinationLabel.trim();
  const originLatitude = Number.parseFloat(values.originLatitude);
  const originLongitude = Number.parseFloat(values.originLongitude);
  const destinationLatitude = Number.parseFloat(values.destinationLatitude);
  const destinationLongitude = Number.parseFloat(values.destinationLongitude);
  const departureDate = values.departureAt ? new Date(values.departureAt) : null;
  const estimatedArrivalDate = values.estimatedArrivalAt ? new Date(values.estimatedArrivalAt) : null;
  const seatCount = Number.parseInt(values.seatCount, 10);
  const basePriceReference = Number.parseFloat(values.basePriceReference);
  const detourSurchargeReference = values.detourSurchargeReference
    ? Number.parseFloat(values.detourSurchargeReference)
    : 0;
  const validationIssues: string[] = [];
  const validationWarnings: string[] = [];

  if (!values.vehicleId) {
    validationIssues.push('Selecciona un vehiculo antes de crear el viaje.');
  }

  if (!originLabel || !destinationLabel) {
    validationIssues.push('Debes completar origen y destino.');
  } else if (originLabel.toLowerCase() === destinationLabel.toLowerCase()) {
    validationIssues.push('Origen y destino no pueden ser iguales.');
  }

  if (
    Number.isNaN(originLatitude) ||
    originLatitude < -90 ||
    originLatitude > 90 ||
    Number.isNaN(destinationLatitude) ||
    destinationLatitude < -90 ||
    destinationLatitude > 90 ||
    Number.isNaN(originLongitude) ||
    originLongitude < -180 ||
    originLongitude > 180 ||
    Number.isNaN(destinationLongitude) ||
    destinationLongitude < -180 ||
    destinationLongitude > 180
  ) {
    validationIssues.push('Las coordenadas deben estar dentro de rangos geograficos validos.');
  } else if (
    originLatitude === destinationLatitude &&
    originLongitude === destinationLongitude
  ) {
    validationIssues.push('El origen y el destino no pueden tener exactamente las mismas coordenadas.');
  }

  if (!departureDate || Number.isNaN(departureDate.getTime())) {
    validationIssues.push('Debes indicar una fecha de salida valida.');
  } else if (departureDate <= now) {
    validationIssues.push('La salida debe programarse en una fecha futura.');
  }

  if (!estimatedArrivalDate || Number.isNaN(estimatedArrivalDate.getTime())) {
    validationIssues.push('Debes indicar una llegada estimada valida.');
  } else if (departureDate && estimatedArrivalDate <= departureDate) {
    validationIssues.push('La llegada estimada debe ser posterior a la salida.');
  }

  if (Number.isNaN(seatCount) || seatCount < 1) {
    validationIssues.push('El viaje debe tener al menos 1 cupo disponible.');
  } else if (selectedVehicle && seatCount > selectedVehicle.seatCount) {
    validationIssues.push(
      `El viaje no puede exceder los ${selectedVehicle.seatCount} cupos del vehiculo seleccionado.`,
    );
  }

  if (Number.isNaN(basePriceReference) || basePriceReference < 0) {
    validationIssues.push('El precio base debe ser un numero mayor o igual a 0.');
  }

  if (Number.isNaN(detourSurchargeReference) || detourSurchargeReference < 0) {
    validationIssues.push('El recargo por desvio no puede ser negativo.');
  }

  if (
    values.routeMode === TripRouteMode.DirectRoute &&
    values.detourSurchargeReference &&
    detourSurchargeReference > 0
  ) {
    validationWarnings.push(
      'El viaje es directo, por lo que el recargo por desvio no se utilizara aunque este cargado.',
    );
  }

  const canSubmit = !disabled && !isSubmitting && validationIssues.length === 0;

  return (
    <article className="panel panel-stack">
      <div>
        <h2 className="panel-title">Crear viaje</h2>
        <p className="panel-text">
          Los viajes se crean en borrador. Luego puedes publicarlos cuando todo este correcto.
        </p>
      </div>

      <form className="form-stack" onSubmit={onSubmit}>
        <div className="form-grid form-grid-2">
          <SelectField
            disabled={disabled}
            label="Vehiculo"
            onChange={(event) => onChange('vehicleId', event.target.value)}
            required
            value={values.vehicleId}
          >
            <option value="">Selecciona un vehiculo</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {(vehicle.customBrandName ?? vehicle.brandName ?? 'Marca')} {(vehicle.customModelName ?? vehicle.modelName ?? 'Modelo')} · {vehicle.plate}
              </option>
            ))}
          </SelectField>

          <SelectField
            disabled={disabled}
            label="Modo de ruta"
            onChange={(event) => onChange('routeMode', event.target.value)}
            required
            value={values.routeMode}
          >
            {ROUTE_MODES.map((routeMode) => (
              <option key={routeMode} value={routeMode}>
                {getTripRouteModeLabel(routeMode)}
              </option>
            ))}
          </SelectField>
        </div>

        <div className="form-grid form-grid-2">
          <InputField
            disabled={disabled}
            label="Origen"
            onChange={(event) => onChange('originLabel', event.target.value)}
            placeholder="Campus Ingahurco"
            required
            value={values.originLabel}
          />
          <InputField
            disabled={disabled}
            label="Destino"
            onChange={(event) => onChange('destinationLabel', event.target.value)}
            placeholder="Ficoa"
            required
            value={values.destinationLabel}
          />
        </div>

        <div className="form-grid form-grid-4">
          <InputField
            disabled={disabled}
            label="Latitud origen"
            onChange={(event) => onChange('originLatitude', event.target.value)}
            placeholder="-1.2414"
            required
            type="number"
            value={values.originLatitude}
          />
          <InputField
            disabled={disabled}
            label="Longitud origen"
            onChange={(event) => onChange('originLongitude', event.target.value)}
            placeholder="-78.6278"
            required
            type="number"
            value={values.originLongitude}
          />
          <InputField
            disabled={disabled}
            label="Latitud destino"
            onChange={(event) => onChange('destinationLatitude', event.target.value)}
            placeholder="-1.2520"
            required
            type="number"
            value={values.destinationLatitude}
          />
          <InputField
            disabled={disabled}
            label="Longitud destino"
            onChange={(event) => onChange('destinationLongitude', event.target.value)}
            placeholder="-78.6160"
            required
            type="number"
            value={values.destinationLongitude}
          />
        </div>

        <div className="form-grid form-grid-2">
          <InputField
            disabled={disabled}
            label="Salida"
            onChange={(event) => onChange('departureAt', event.target.value)}
            required
            type="datetime-local"
            value={values.departureAt}
          />
          <InputField
            disabled={disabled}
            label="Llegada estimada"
            onChange={(event) => onChange('estimatedArrivalAt', event.target.value)}
            required
            type="datetime-local"
            value={values.estimatedArrivalAt}
          />
        </div>

        <div className="form-grid form-grid-3">
          <InputField
            disabled={disabled}
            label="Cupos"
            onChange={(event) => onChange('seatCount', event.target.value)}
            required
            type="number"
            value={values.seatCount}
          />
          <InputField
            disabled={disabled}
            label="Precio base"
            onChange={(event) => onChange('basePriceReference', event.target.value)}
            required
            step="0.01"
            type="number"
            value={values.basePriceReference}
          />
          <InputField
            disabled={disabled || values.routeMode === TripRouteMode.DirectRoute}
            label="Recargo por desvio"
            onChange={(event) => onChange('detourSurchargeReference', event.target.value)}
            step="0.01"
            type="number"
            value={values.detourSurchargeReference}
          />
        </div>

        <TextareaField
          disabled={disabled}
          hint="Opcional. Puedes incluir detalles de recogida, restricciones o equipaje."
          label="Notas"
          onChange={(event) => onChange('notes', event.target.value)}
          placeholder="Indicaciones adicionales del viaje"
          rows={4}
          value={values.notes}
        />

        {validationIssues.length ? (
          <div className="validation-card validation-card-danger">
            <strong>Revisa estos puntos antes de crear el viaje:</strong>
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
          {isSubmitting ? 'Creando...' : 'Crear viaje'}
        </Button>
      </form>
    </article>
  );
}
