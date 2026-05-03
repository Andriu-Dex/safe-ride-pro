import {
  TripAvailabilityFilter,
  TripRouteMode,
  VehicleType,
} from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { isGeoapifyConfigured } from '../lib/geoapify';
import type { TripFilters } from '../types/trip';
import { getTripRouteModeLabel } from '../lib/trip-labels';
import { getVehicleTypeLabel } from '../../vehicles/lib/vehicle-labels';
import { PlaceAutocompleteField } from './place-autocomplete-field';

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
  const isGeoSearchEnabled = isGeoapifyConfigured();

  return (
    <form className="form-stack" onSubmit={onApply}>
      <div className="form-grid form-grid-2">
        {isGeoSearchEnabled ? (
          <>
            <PlaceAutocompleteField
              label="Origen"
              onClear={() => onChange('origin', '')}
              onSelect={(place) => onChange('origin', place.label)}
              onValueChange={(nextValue) => onChange('origin', nextValue)}
              placeholder="Buscar origen"
              selectedPlace={null}
              value={values.origin ?? ''}
            />
            <PlaceAutocompleteField
              label="Destino"
              onClear={() => onChange('destination', '')}
              onSelect={(place) => onChange('destination', place.label)}
              onValueChange={(nextValue) => onChange('destination', nextValue)}
              placeholder="Buscar destino"
              selectedPlace={null}
              value={values.destination ?? ''}
            />
          </>
        ) : (
          <>
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
          </>
        )}
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
        <InputField
          label="Hora desde"
          onChange={(event) => onChange('timeFrom', event.target.value)}
          type="time"
          value={values.timeFrom ?? ''}
        />
        <InputField
          label="Hora hasta"
          onChange={(event) => onChange('timeTo', event.target.value)}
          type="time"
          value={values.timeTo ?? ''}
        />
      </div>

      <div className="form-grid form-grid-3">
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
        <SelectField
          label="Disponibilidad"
          onChange={(event) => onChange('availability', event.target.value)}
          value={values.availability ?? ''}
        >
          <option value="">Todos</option>
          <option value={TripAvailabilityFilter.Available}>Solo con cupos</option>
          <option value={TripAvailabilityFilter.Full}>Solo sin cupos</option>
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
  );
}
