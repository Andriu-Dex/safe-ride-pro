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

        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        {successMessage ? <div className="form-success">{successMessage}</div> : null}

        <Button disabled={disabled || isSubmitting} type="submit">
          {isSubmitting ? 'Creando...' : 'Crear viaje'}
        </Button>
      </form>
    </article>
  );
}
