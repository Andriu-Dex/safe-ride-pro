import {
  TripRouteMode,
  VehicleType,
} from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import type { TripFilters } from '../types/trip';
import { getTripRouteModeLabel } from '../lib/trip-labels';
import { getVehicleTypeLabel } from '../../vehicles/lib/vehicle-labels';

type TripFiltersPanelProps = {
  values: TripFilters;
  onChange: (field: keyof TripFilters, value: string) => void;
  onApply: (event: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  isSubmitting: boolean;
};

export function TripFiltersPanel({
  values,
  onChange,
  onApply,
  onReset,
  isSubmitting,
}: TripFiltersPanelProps) {
  return (
    <article className="panel panel-stack">
      <div className="panel-header-row">
        <div>
          <h2 className="panel-title">Filtros de viajes</h2>
          <p className="panel-text">
            Puedes refinar tanto tus viajes como los viajes disponibles por origen, destino, fecha y modalidad.
          </p>
        </div>
      </div>

      <form className="form-stack" onSubmit={onApply}>
        <div className="form-grid form-grid-2">
          <InputField
            label="Origen"
            onChange={(event) => onChange('origin', event.target.value)}
            placeholder="Campus Ingahurco"
            value={values.origin ?? ''}
          />
          <InputField
            label="Destino"
            onChange={(event) => onChange('destination', event.target.value)}
            placeholder="Ficoa"
            value={values.destination ?? ''}
          />
        </div>

        <div className="form-grid form-grid-4">
          <InputField
            label="Fecha desde"
            onChange={(event) => onChange('dateFrom', event.target.value)}
            type="date"
            value={values.dateFrom ?? ''}
          />
          <InputField
            label="Fecha hasta"
            onChange={(event) => onChange('dateTo', event.target.value)}
            type="date"
            value={values.dateTo ?? ''}
          />
          <SelectField
            label="Modo de ruta"
            onChange={(event) => onChange('routeMode', event.target.value)}
            value={values.routeMode ?? ''}
          >
            <option value="">Todos</option>
            <option value={TripRouteMode.DirectRoute}>{getTripRouteModeLabel(TripRouteMode.DirectRoute)}</option>
            <option value={TripRouteMode.PlannedDetour}>{getTripRouteModeLabel(TripRouteMode.PlannedDetour)}</option>
          </SelectField>
          <SelectField
            label="Tipo de vehiculo"
            onChange={(event) => onChange('vehicleType', event.target.value)}
            value={values.vehicleType ?? ''}
          >
            <option value="">Todos</option>
            <option value={VehicleType.Motorcycle}>{getVehicleTypeLabel(VehicleType.Motorcycle)}</option>
            <option value={VehicleType.Car}>{getVehicleTypeLabel(VehicleType.Car)}</option>
            <option value={VehicleType.PickupTruck}>{getVehicleTypeLabel(VehicleType.PickupTruck)}</option>
          </SelectField>
        </div>

        <div className="button-row">
          <Button disabled={isSubmitting} type="submit" variant="secondary">
            {isSubmitting ? 'Filtrando...' : 'Aplicar filtros'}
          </Button>
          <Button disabled={isSubmitting} onClick={onReset} type="button" variant="ghost">
            Limpiar filtros
          </Button>
        </div>
      </form>
    </article>
  );
}
