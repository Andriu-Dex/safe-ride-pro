import { TripRouteMode } from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { TextareaField } from '../../../components/ui/textarea-field';
import type { VehicleRecord } from '../../vehicles/types/vehicle';
import {
  getGeoapifySetupMessage,
  isGeoapifyConfigured,
} from '../lib/geoapify';
import { getTripRouteModeLabel } from '../lib/trip-labels';
import type { LatestTripRouteTemplate } from '../types/trip';
import type { PlaceSelection } from '../types/place-selection';
import type { TripFormValues } from './trips-workspace.types';
import { PlaceAutocompleteField } from './place-autocomplete-field';
import { TripRouteMap } from './trip-route-map';

type TripCreationFormProps = {
  values: TripFormValues;
  vehicles: VehicleRecord[];
  disabled: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  onChange: (field: keyof TripFormValues, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  latestRouteTemplate: LatestTripRouteTemplate | null;
  onUseLatestRoute: () => void;
  onReset: () => void;
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
  latestRouteTemplate,
  onUseLatestRoute,
  onReset,
}: TripCreationFormProps) {
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === values.vehicleId);
  const isMapsEnabled = isGeoapifyConfigured();
  const now = new Date();
  const originLabel = values.originLabel.trim();
  const destinationLabel = values.destinationLabel.trim();
  const originLatitude = Number.parseFloat(values.originLatitude);
  const originLongitude = Number.parseFloat(values.originLongitude);
  const destinationLatitude = Number.parseFloat(values.destinationLatitude);
  const destinationLongitude = Number.parseFloat(values.destinationLongitude);
  const originSelection = buildPlaceSelection(originLabel, originLatitude, originLongitude);
  const destinationSelection = buildPlaceSelection(
    destinationLabel,
    destinationLatitude,
    destinationLongitude,
  );
  const departureDate = values.departureAt ? new Date(values.departureAt) : null;
  const estimatedArrivalDate = values.estimatedArrivalAt
    ? new Date(values.estimatedArrivalAt)
    : null;
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
    validationIssues.push(
      'El origen y el destino no pueden tener exactamente las mismas coordenadas.',
    );
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

  const progress = [
    {
      label: 'Vehiculo',
      complete: Boolean(values.vehicleId),
      helper: selectedVehicle ? getVehicleLabel(selectedVehicle) : 'Elige el vehiculo que operara el trayecto.',
    },
    {
      label: 'Ruta',
      complete: Boolean(originSelection && destinationSelection),
      helper:
        originSelection && destinationSelection
          ? `${originLabel} -> ${destinationLabel}`
          : 'Define origen y destino con coordenadas validas.',
    },
    {
      label: 'Horario',
      complete:
        Boolean(departureDate && estimatedArrivalDate) &&
        validationIssues.every(
          (issue) =>
            issue !== 'Debes indicar una fecha de salida valida.' &&
            issue !== 'La salida debe programarse en una fecha futura.' &&
            issue !== 'Debes indicar una llegada estimada valida.' &&
            issue !== 'La llegada estimada debe ser posterior a la salida.',
        ),
      helper:
        departureDate && estimatedArrivalDate
          ? `${formatDateTime(values.departureAt)} -> ${formatDateTime(values.estimatedArrivalAt)}`
          : 'Programa salida y llegada estimada.',
    },
    {
      label: 'Precio',
      complete: !Number.isNaN(basePriceReference) && basePriceReference >= 0,
      helper:
        values.routeMode === TripRouteMode.PlannedDetour
          ? `$${formatCurrency(basePriceReference)} base + $${formatCurrency(
              detourSurchargeReference,
            )} de desvio`
          : `$${formatCurrency(basePriceReference)} referencial`,
    },
  ];
  const completedSteps = progress.filter((step) => step.complete).length;
  const canSubmit = !disabled && !isSubmitting && validationIssues.length === 0;
  const durationLabel = getDurationLabel(departureDate, estimatedArrivalDate);

  return (
    <article className="trip-creation-shell">
      <div className="trip-creation-header">
        <div className="trip-creation-copy">
          <p className="section-label">Creacion guiada</p>
          <h2 className="trip-creation-title">Configura tu viaje paso a paso</h2>
        </div>

        <div className="trip-creation-progress-grid">
          <div className="trip-creation-progress-card">
            <span>Avance</span>
            <strong>
              {completedSteps}/{progress.length}
            </strong>
          </div>
          <div className="trip-creation-progress-card">
            <span>Duracion estimada</span>
            <strong>{durationLabel}</strong>
          </div>
        </div>
      </div>

      <div className="trip-creation-steps">
        {progress.map((step, index) => (
          <div
            key={step.label}
            className={[
              'trip-progress-pill',
              step.complete ? 'trip-progress-pill-complete' : null,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="trip-progress-pill-index">0{index + 1}</span>
            <div>
              <strong>{step.label}</strong>
            </div>
          </div>
        ))}
      </div>

      {latestRouteTemplate ? (
        <section className="trip-template-card trip-template-card-prominent">
          <div className="trip-template-card-header">
            <div>
              <p className="section-label">Ruta reutilizable</p>
              <h3 className="panel-title">Tu ultima ruta guardada</h3>
              <strong>{latestRouteTemplate.originLabel} {'->'} {latestRouteTemplate.destinationLabel}</strong>
            </div>
            <div className="button-row">
              <Button
                disabled={disabled}
                onClick={onReset}
                type="button"
                variant="ghost"
              >
                Empezar en blanco
              </Button>
              <Button
                disabled={disabled}
                onClick={onUseLatestRoute}
                type="button"
                variant="secondary"
              >
                Usar esta ruta
              </Button>
            </div>
          </div>
          <div className="trip-template-meta">
            <span>
              Vehiculo sugerido: {latestRouteTemplate.vehicleDisplayName} ({latestRouteTemplate.vehiclePlate})
            </span>
            <span>Ultimo uso: {formatDateTime(latestRouteTemplate.departureAt)}</span>
          </div>
        </section>
      ) : null}

      <form className="trip-creation-form-stack" onSubmit={onSubmit}>
        <section className="trip-form-section-card">
          <TripFormSectionHeader
            badge="01"
            title="Base operativa"
          />

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
                  {getVehicleLabel(vehicle)} - {vehicle.plate}
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

          <div className="trip-form-info-grid">
            <TripMiniInfoCard
              description={
                selectedVehicle
                  ? `${selectedVehicle.seatCount} cupos maximos en ${selectedVehicle.plate}`
                  : 'El sistema limitara los cupos segun el vehiculo elegido.'
              }
              label="Capacidad"
            />
            <TripMiniInfoCard
              description={
                values.routeMode === TripRouteMode.PlannedDetour
                  ? 'Podras registrar recargo por desvio planificado.'
                  : 'La experiencia sera mas simple y sin recargo de desvio.'
              }
              label="Politica de ruta"
            />
          </div>
        </section>

        <section className="trip-form-section-card">
          <TripFormSectionHeader
            badge="02"
            title="Ruta y ubicaciones"
          />

          <div className="form-grid form-grid-2">
            {isMapsEnabled ? (
              <>
                <PlaceAutocompleteField
                  disabled={disabled}
                  hint="Busca el punto exacto de salida dentro de la ciudad o campus."
                  label="Origen"
                  onValueChange={(nextValue) => {
                    onChange('originLabel', nextValue);
                    onChange('originLatitude', '');
                    onChange('originLongitude', '');
                  }}
                  onClear={() => {
                    onChange('originLabel', '');
                    onChange('originLatitude', '');
                    onChange('originLongitude', '');
                  }}
                  onSelect={(place) => {
                    onChange('originLabel', place.label);
                    onChange('originLatitude', place.latitude.toFixed(6));
                    onChange('originLongitude', place.longitude.toFixed(6));
                  }}
                  placeholder="Busca el origen"
                  selectedPlace={originSelection}
                  value={values.originLabel}
                />
                <PlaceAutocompleteField
                  disabled={disabled}
                  hint="Busca el punto exacto de llegada para el viaje."
                  label="Destino"
                  onValueChange={(nextValue) => {
                    onChange('destinationLabel', nextValue);
                    onChange('destinationLatitude', '');
                    onChange('destinationLongitude', '');
                  }}
                  onClear={() => {
                    onChange('destinationLabel', '');
                    onChange('destinationLatitude', '');
                    onChange('destinationLongitude', '');
                  }}
                  onSelect={(place) => {
                    onChange('destinationLabel', place.label);
                    onChange('destinationLatitude', place.latitude.toFixed(6));
                    onChange('destinationLongitude', place.longitude.toFixed(6));
                  }}
                  placeholder="Busca el destino"
                  selectedPlace={destinationSelection}
                  value={values.destinationLabel}
                />
              </>
            ) : (
              <>
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
              </>
            )}
          </div>

          {isMapsEnabled ? (
            <section className="trip-map-card trip-map-card-expanded" aria-label="Mapa y coordenadas del viaje">
              <div className="trip-map-card-header">
                <div>
                  <strong className="trip-map-card-title">Mapa de confirmacion</strong>
                </div>
                <span className="topbar-badge">
                  {originSelection || destinationSelection
                    ? 'Ubicaciones detectadas'
                    : 'Pendiente de seleccion'}
                </span>
              </div>
              <TripRouteMap destination={destinationSelection} origin={originSelection} />
              <div className="trip-location-grid">
                <TripCoordinateCard
                  emptyMessage="Selecciona un origen para completar automaticamente la coordenada."
                  label="Coordenadas de origen"
                  latitude={values.originLatitude}
                  longitude={values.originLongitude}
                />
                <TripCoordinateCard
                  emptyMessage="Selecciona un destino para completar automaticamente la coordenada."
                  label="Coordenadas de destino"
                  latitude={values.destinationLatitude}
                  longitude={values.destinationLongitude}
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
            </section>
          ) : (
            <>
              <div className="form-helper">{getGeoapifySetupMessage()}</div>
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
            </>
          )}
        </section>

        <section className="trip-form-section-card">
          <TripFormSectionHeader
            badge="03"
            title="Horario, cupos y precio"
          />

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

          <div className="trip-form-info-grid">
            <TripMiniInfoCard
              description={durationLabel}
              label="Duracion esperada"
            />
            <TripMiniInfoCard
              description={
                Number.isNaN(seatCount) ? 'Ingresa un valor valido para los cupos.' : `${seatCount} cupo(s) visibles para pasajeros`
              }
              label="Oferta inicial"
            />
            <TripMiniInfoCard
              description={
                values.routeMode === TripRouteMode.PlannedDetour
                  ? `Total referencial con desvio: $${formatCurrency(
                      basePriceReference + detourSurchargeReference,
                    )}`
                  : `Precio referencial: $${formatCurrency(basePriceReference)}`
              }
              label="Referencia economica"
            />
          </div>
        </section>

        <section className="trip-form-section-card">
          <TripFormSectionHeader
            badge="04"
            title="Notas operativas"
          />

          <TextareaField
            disabled={disabled}
            hint="Opcional. Puedes incluir detalles de recogida, restricciones o equipaje."
            label="Notas"
            onChange={(event) => onChange('notes', event.target.value)}
            placeholder="Ejemplo: punto de encuentro junto al ingreso principal, equipaje pequeno, salida puntual."
            rows={4}
            value={values.notes}
          />
        </section>

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
            <strong>Advertencias utiles para revisar antes de guardar:</strong>
            <ul className="validation-list">
              {validationWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        {successMessage ? <div className="form-success">{successMessage}</div> : null}

        <div className="trip-form-action-bar">
          <div className="trip-form-action-copy">
            <strong>{canSubmit ? 'Listo para guardar el viaje' : 'Aun faltan datos por completar'}</strong>
          </div>
          <div className="trip-form-action-buttons">
            <Button
              disabled={disabled || isSubmitting}
              onClick={onReset}
              type="button"
              variant="ghost"
            >
              Limpiar
            </Button>
            <Button disabled={!canSubmit} type="submit">
              {isSubmitting ? 'Guardando...' : 'Guardar viaje'}
            </Button>
          </div>
        </div>
      </form>
    </article>
  );
}

function buildPlaceSelection(
  label: string,
  latitude: number,
  longitude: number,
): PlaceSelection | null {
  if (!label || Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }

  return {
    label,
    address: null,
    latitude,
    longitude,
  };
}

function TripFormSectionHeader({
  badge,
  title,
}: {
  badge: string;
  title: string;
}) {
  return (
    <div className="trip-form-section-header">
      <span className="trip-form-section-badge">{badge}</span>
      <div className="trip-form-section-copy">
        <h3 className="trip-form-section-title">{title}</h3>
      </div>
    </div>
  );
}

function TripMiniInfoCard({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <div className="trip-mini-info-card">
      <span>{label}</span>
      <strong>{description}</strong>
    </div>
  );
}

function TripCoordinateCard({
  label,
  latitude,
  longitude,
  emptyMessage,
}: {
  label: string;
  latitude: string;
  longitude: string;
  emptyMessage: string;
}) {
  const hasCoordinates = latitude.trim() && longitude.trim();

  return (
    <div className="trip-coordinate-card">
      <span className="trip-coordinate-card-label">{label}</span>
      {hasCoordinates ? (
        <div className="trip-coordinate-card-values">
          <strong>{latitude}</strong>
          <strong>{longitude}</strong>
        </div>
      ) : (
        <p className="panel-text">{emptyMessage}</p>
      )}
    </div>
  );
}

function getVehicleLabel(vehicle: VehicleRecord): string {
  return `${vehicle.customBrandName ?? vehicle.brandName ?? 'Marca'} ${vehicle.customModelName ?? vehicle.modelName ?? 'Modelo'}`.trim();
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getDurationLabel(
  departureDate: Date | null,
  estimatedArrivalDate: Date | null,
): string {
  if (
    !departureDate ||
    Number.isNaN(departureDate.getTime()) ||
    !estimatedArrivalDate ||
    Number.isNaN(estimatedArrivalDate.getTime()) ||
    estimatedArrivalDate <= departureDate
  ) {
    return 'Pendiente';
  }

  const minutes = Math.round(
    (estimatedArrivalDate.getTime() - departureDate.getTime()) / 60_000,
  );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

function formatCurrency(value: number): string {
  if (Number.isNaN(value)) {
    return '0.00';
  }

  return value.toFixed(2);
}

