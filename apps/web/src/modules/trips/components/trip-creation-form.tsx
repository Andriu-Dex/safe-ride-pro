import { useEffect, useRef, useState } from 'react';
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
import type { RecentTripRouteTemplate } from '../types/trip';
import type { PlaceSelection } from '../types/place-selection';
import type { TripFormValues } from './trips-workspace.types';
import { PlaceAutocompleteField } from './place-autocomplete-field';
import { TripRouteMap } from './trip-route-map';
import styles from './trip-creation-form.module.css';

type TripCreationFormProps = {
  values: TripFormValues;
  vehicles: VehicleRecord[];
  disabled: boolean;
  isSubmitting: boolean;
  headerKicker?: string;
  title?: string;
  lead?: string;
  submitLabel?: string;
  submittingLabel?: string;
  readyCopy?: string;
  pendingCopy?: string;
  onChange: (field: keyof TripFormValues, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  recentRouteTemplates: RecentTripRouteTemplate[];
  onUseRouteTemplate: (templateId: string) => void;
  onReset: () => void;
};

type SelectionTarget = 'origin' | 'destination';

const ROUTE_MODES = [TripRouteMode.DirectRoute, TripRouteMode.PlannedDetour] as const;

export function TripCreationForm({
  values,
  vehicles,
  disabled,
  isSubmitting,
  headerKicker = 'Creacion',
  title = 'Arma tu proximo viaje',
  lead = 'Define ruta, horario y cupos en una sola pasada.',
  submitLabel = 'Crear viaje',
  submittingLabel = 'Guardando...',
  readyCopy = 'Listo para crear el viaje',
  pendingCopy = 'Completa los datos pendientes',
  onChange,
  onSubmit,
  recentRouteTemplates,
  onUseRouteTemplate,
  onReset,
}: TripCreationFormProps) {
  const [activeTarget, setActiveTarget] = useState<SelectionTarget>('origin');
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === values.vehicleId);
  const isMapsEnabled = isGeoapifyConfigured();
  const now = new Date();
  const originLabel = values.originLabel.trim();
  const destinationLabel = values.destinationLabel.trim();
  const originLatitude = Number.parseFloat(values.originLatitude);
  const originLongitude = Number.parseFloat(values.originLongitude);
  const destinationLatitude = Number.parseFloat(values.destinationLatitude);
  const destinationLongitude = Number.parseFloat(values.destinationLongitude);
  const hasOriginSelection =
    originLabel.length > 0 && !Number.isNaN(originLatitude) && !Number.isNaN(originLongitude);
  const hasDestinationSelection =
    destinationLabel.length > 0
    && !Number.isNaN(destinationLatitude)
    && !Number.isNaN(destinationLongitude);
  const effectiveSelectionTarget: SelectionTarget =
    !hasOriginSelection ? 'origin' : !hasDestinationSelection ? 'destination' : activeTarget;
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
  const lastCalcTriggerRef = useRef({
    departure: values.departureAt,
    origLat: originLatitude,
    destLat: destinationLatitude,
  });

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

  const handleMapSelect = ({
    latitude,
    longitude,
    target,
  }: {
    latitude: number;
    longitude: number;
    target: 'origin' | 'destination' | 'pickup' | 'dropoff';
  }) => {
    if (target === 'origin') {
      onChange('originLatitude', latitude.toFixed(6));
      onChange('originLongitude', longitude.toFixed(6));
      onChange('originLabel', 'Punto de origen en el mapa');
      setActiveTarget('destination');
      return;
    }

    onChange('destinationLatitude', latitude.toFixed(6));
    onChange('destinationLongitude', longitude.toFixed(6));
    onChange('destinationLabel', 'Punto de destino en el mapa');
  };

  const handleRouteModeChange = (nextRouteMode: TripRouteMode) => {
    onChange('routeMode', nextRouteMode);

    if (nextRouteMode === TripRouteMode.DirectRoute && values.detourSurchargeReference !== '0') {
      onChange('detourSurchargeReference', '0');
    }
  };

  useEffect(() => {
    if (disabled || values.vehicleId || vehicles.length !== 1) {
      return;
    }

    onChange('vehicleId', vehicles[0].id);
  }, [disabled, onChange, values.vehicleId, vehicles]);

  useEffect(() => {
    if (
      !values.departureAt ||
      Number.isNaN(originLatitude) ||
      Number.isNaN(destinationLatitude)
    ) {
      return;
    }

    const triggerChanged =
      lastCalcTriggerRef.current.departure !== values.departureAt ||
      lastCalcTriggerRef.current.origLat !== originLatitude ||
      lastCalcTriggerRef.current.destLat !== destinationLatitude;

    if (triggerChanged || !values.estimatedArrivalAt) {
      const estimated = calculateEstimatedArrival(
        originLatitude,
        originLongitude,
        destinationLatitude,
        destinationLongitude,
        values.departureAt,
      );

      lastCalcTriggerRef.current = {
        departure: values.departureAt,
        origLat: originLatitude,
        destLat: destinationLatitude,
      };

      if (values.estimatedArrivalAt !== estimated) {
        onChange('estimatedArrivalAt', estimated);
      }
    }
  }, [
    values.departureAt,
    values.estimatedArrivalAt,
    originLatitude,
    originLongitude,
    destinationLatitude,
    destinationLongitude,
    onChange,
  ]);

  const canSubmit = !disabled && !isSubmitting && validationIssues.length === 0;
  const durationLabel = getDurationLabel(departureDate, estimatedArrivalDate);
  const routeModeLabel = getTripRouteModeLabel(values.routeMode);
  const referencePriceLabel =
    values.routeMode === TripRouteMode.PlannedDetour
      ? `$${formatCurrency(basePriceReference + detourSurchargeReference)}`
      : `$${formatCurrency(basePriceReference)}`;

  return (
    <article className={styles.shell}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <p className={styles.kicker}>{headerKicker}</p>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.lead}>{lead}</p>
        </div>

        <div className={styles.headerStats}>
          <div className={styles.statCard}>
            <span>Duracion</span>
            <strong>{durationLabel}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Referencia</span>
            <strong>{referencePriceLabel}</strong>
          </div>
        </div>
      </div>

      {recentRouteTemplates.length ? (
        <section className={styles.templateCard}>
          <div className={styles.templateHeader}>
            <div className={styles.templateRoute}>
              <p className={styles.kicker}>Rutas recientes</p>
              <strong>Reutiliza una ruta reciente y ajusta solo lo necesario</strong>
            </div>
            <div className={styles.templateActions}>
              <Button
                disabled={disabled}
                onClick={onReset}
                type="button"
                variant="ghost"
              >
                Empezar en blanco
              </Button>
            </div>
          </div>
          <div className={styles.templateList}>
            {recentRouteTemplates.map((template) => (
              <article key={template.sourceTripId} className={styles.templateItem}>
                <div className={styles.templateItemCopy}>
                  <strong>{template.originLabel} {'->'} {template.destinationLabel}</strong>
                  <div className={styles.templateMeta}>
                    <span>
                      {template.vehicleDisplayName} ({template.vehiclePlate})
                    </span>
                    <span>Ultimo uso: {formatDateTime(template.departureAt)}</span>
                  </div>
                </div>
                <Button
                  disabled={disabled}
                  onClick={() => onUseRouteTemplate(template.sourceTripId)}
                  type="button"
                  variant="secondary"
                >
                  Usar esta ruta
                </Button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <form className={styles.formStack} onSubmit={onSubmit}>
        <section className={styles.sectionCard}>
          <TripFormSectionHeader
            badge="01"
            hint="Vehiculo y modalidad"
            title="Base operativa"
          />

          <div className={styles.grid2}>
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
              onChange={(event) => handleRouteModeChange(event.target.value as TripRouteMode)}
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

          <div className={styles.miniGrid}>
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

        <section className={styles.sectionCard}>
          <TripFormSectionHeader
            badge="02"
            hint="Origen, destino y coordenadas"
            title="Ruta y ubicaciones"
          />

          <div className={styles.grid2}>
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
            <section className={styles.mapCard} aria-label="Mapa y coordenadas del viaje">
                <div className={styles.mapBody}>
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#0f766e', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.85rem' }}>
                      {effectiveSelectionTarget === 'origin' ? (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                          Primer clic: marca la salida en el mapa
                        </>
                      ) : (
                        <>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                          Segundo clic: marca la llegada en el mapa
                        </>
                      )}
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <Button
                        disabled={disabled}
                        onClick={() => setActiveTarget('origin')}
                        type="button"
                        variant={effectiveSelectionTarget === 'origin' ? 'primary' : 'secondary'}
                      >
                        Origen
                      </Button>
                      <Button
                        disabled={disabled}
                        onClick={() => setActiveTarget('destination')}
                        type="button"
                        variant={effectiveSelectionTarget === 'destination' ? 'primary' : 'secondary'}
                      >
                        Destino
                      </Button>
                    </div>
                  </div>

                  <div className={styles.mapFrame}>
                    <TripRouteMap 
                      destination={destinationSelection} 
                      onMapSelect={handleMapSelect}
                      origin={originSelection} 
                      selectionMode={effectiveSelectionTarget}
                    />
                  </div>

                  <div className={styles.coordinateGrid}>
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
                </div>
            </section>
          ) : (
            <>
              <div className="form-helper">{getGeoapifySetupMessage()}</div>
              <div className={styles.grid4}>
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

        <section className={styles.sectionCard}>
          <TripFormSectionHeader
            badge="03"
            hint="Salida, llegada, cupos y tarifa"
            title="Horario, cupos y precio"
          />

          <div className={styles.grid2}>
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

          <div className={styles.grid3}>
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
              onFocus={() => {
                if (values.basePriceReference === '0' || values.basePriceReference === '0.00') {
                  onChange('basePriceReference', '');
                }
              }}
              placeholder="0.00"
              required
              step="0.01"
              type="number"
              value={values.basePriceReference}
            />
            {values.routeMode === TripRouteMode.PlannedDetour ? (
              <InputField
                disabled={disabled}
                label="Recargo por desvio"
                onChange={(event) => onChange('detourSurchargeReference', event.target.value)}
                onFocus={() => {
                  if (values.detourSurchargeReference === '0' || values.detourSurchargeReference === '0.00') {
                    onChange('detourSurchargeReference', '');
                  }
                }}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={values.detourSurchargeReference}
              />
            ) : null}
          </div>

          <div className={styles.miniGrid}>
            <TripMiniInfoCard
              description={durationLabel}
              label="Duracion esperada"
            />
            <TripMiniInfoCard
              description={
                Number.isNaN(seatCount) ? 'Ingresa un valor valido para los cupos.' : `${seatCount} cupo(s) disponibles`
              }
              label="Oferta inicial"
            />
            <TripMiniInfoCard
              description={
                values.routeMode === TripRouteMode.PlannedDetour
                  ? `Total referencial con desvio: $${formatCurrency(
                      basePriceReference + detourSurchargeReference,
                    )}`
                  : `$${formatCurrency(basePriceReference)}`
              }
              label="Precio referencial:"
            />
          </div>
        </section>

        <section className={styles.sectionCard}>
          <TripFormSectionHeader
            badge="04"
            hint="Detalles opcionales para pasajeros"
            title="Notas operativas"
          />

          <TextareaField
            disabled={disabled}
            hint="Opcional. Puedes incluir detalles de recogida, restricciones o equipaje."
            label="Notas"
            onChange={(event) => onChange('notes', event.target.value)}
            rows={4}
            value={values.notes}
          />
        </section>

        <div className={styles.actionBar}>
          <div className={styles.actionCopy}>
            <strong className={styles.summaryTitle}>
              {canSubmit ? readyCopy : pendingCopy}
            </strong>
            <span>
              {selectedVehicle ? `${getVehicleLabel(selectedVehicle)} | ${routeModeLabel}` : 'Selecciona un vehiculo para continuar'}
            </span>
          </div>
          <div className={styles.actionButtons}>
            <Button
              disabled={disabled || isSubmitting}
              onClick={onReset}
              type="button"
              variant="ghost"
            >
              Limpiar
            </Button>
            <Button disabled={!canSubmit} type="submit">
              {isSubmitting ? submittingLabel : submitLabel}
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
  hint,
  title,
}: {
  badge: string;
  hint: string;
  title: string;
}) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.badge}>{badge}</span>
      <div className={styles.sectionLead}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <p className={styles.sectionHint}>{hint}</p>
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
    <div className={styles.miniInfo}>
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
    <div className={styles.coordinateCard}>
      <span className={styles.coordinateLabel}>{label}</span>
      {hasCoordinates ? (
        <div className={styles.coordinateValues}>
          <strong>{latitude}</strong>
          <strong>{longitude}</strong>
        </div>
      ) : (
        <p className={styles.coordinateEmpty}>{emptyMessage}</p>
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

function calculateEstimatedArrival(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  departureStr: string,
): string {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;

  const urbanFactor = 1.4; // Ajuste por calles en lugar de línea recta
  const avgSpeedKmh = 25; // Velocidad promedio urbana conservadora
  const travelHours = (distanceKm * urbanFactor) / avgSpeedKmh;
  const travelMinutes = Math.round(travelHours * 60) + 5; // 5 minutos base (tráfico/semáforos)

  const depDate = new Date(departureStr);
  depDate.setMinutes(depDate.getMinutes() + travelMinutes);

  // Ajustar formato a YYYY-MM-DDTHH:mm preservando hora local
  const tzOffset = depDate.getTimezoneOffset() * 60000;
  return new Date(depDate.getTime() - tzOffset).toISOString().slice(0, 16);
}
