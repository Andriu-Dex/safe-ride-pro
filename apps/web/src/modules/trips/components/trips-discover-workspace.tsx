import { TripRequestStatus, TripRouteMode, TripStatus } from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { DisclosurePanel } from '../../../components/ui/disclosure-panel';
import { InputField } from '../../../components/ui/input-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { TextareaField } from '../../../components/ui/textarea-field';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import type { TripFilters, TripRecord } from '../types/trip';
import { TripFiltersPanel } from './trip-filters-panel';
import { TripOverviewCard } from './trip-overview-card';
import { TripsEditorialEmptyState } from './trips-editorial-empty-state';
import { EMPTY_REQUEST_DRAFT, type TripRequestDraft } from './trips-workspace.types';
import { TripsWorkspaceSkeleton } from './trips-workspace-skeleton';

type TripsDiscoverWorkspaceProps = {
  activeFiltersCount: number;
  activeFilterLabels: string[];
  visibleAvailableTrips: TripRecord[];
  discoverableTripsWithSeatsCount: number;
  filterFormValues: TripFilters;
  isFiltering: boolean;
  requestDrafts: Record<string, TripRequestDraft>;
  myRequests: TripRequestRecord[];
  isMutatingRequestId: string | null;
  isPassengerOperationBlocked: boolean;
  onFilterChange: (field: keyof TripFilters, value: string) => void;
  onApplyFilters: (event: React.FormEvent<HTMLFormElement>) => void;
  onResetFilters: () => void;
  onOpenRequests: () => void;
  onRequestDraftChange: (tripId: string, field: keyof TripRequestDraft, value: string) => void;
  onCreateRequest: (trip: TripRecord) => void;
  canCreateRequestForTrip: (trip: TripRecord, hasActiveRequest: boolean) => boolean;
  isRefreshingData?: boolean;
};

export function TripsDiscoverWorkspace({
  activeFiltersCount,
  activeFilterLabels,
  visibleAvailableTrips,
  discoverableTripsWithSeatsCount,
  filterFormValues,
  isFiltering,
  requestDrafts,
  myRequests,
  isMutatingRequestId,
  isPassengerOperationBlocked,
  onFilterChange,
  onApplyFilters,
  onResetFilters,
  onOpenRequests,
  onRequestDraftChange,
  onCreateRequest,
  canCreateRequestForTrip,
  isRefreshingData = false,
}: TripsDiscoverWorkspaceProps) {
  const activeMyRequestsCount = myRequests.filter(
    (request) =>
      request.status === TripRequestStatus.Pending
      || request.status === TripRequestStatus.Accepted,
  ).length;
  const plannedDetourTripsCount = visibleAvailableTrips.filter(
    (trip) => trip.routeMode === TripRouteMode.PlannedDetour,
  ).length;

  return (
    <section className="trips-discover-stack">
      {isRefreshingData ? <TripsWorkspaceSkeleton variant="discover" /> : null}

      <article className="panel panel-stack trip-search-summary-panel trip-discover-command-panel">
        <div className="trip-discover-command-header">
          <div className="section-heading">
            <h2 className="panel-title">Explorar cupos</h2>
            <p className="section-heading-meta">{visibleAvailableTrips.length} opciones visibles</p>
          </div>
          <div className="button-row trip-discover-command-actions">
            <Button onClick={onOpenRequests} variant="secondary">
              Mis solicitudes
            </Button>
          </div>
        </div>

        <div className="trip-discover-insight-grid">
          <DiscoverSummaryCard
            label="Disponibles"
            tone="success"
            value={`${discoverableTripsWithSeatsCount}`}
          />
          <DiscoverSummaryCard
            label="Solicitudes activas"
            tone="neutral"
            value={`${activeMyRequestsCount}`}
          />
          <DiscoverSummaryCard
            label="Con desvio"
            tone="neutral"
            value={`${plannedDetourTripsCount}`}
          />
          <DiscoverSummaryCard
            label="Acceso pasajero"
            tone={isPassengerOperationBlocked ? 'warning' : 'success'}
            value={isPassengerOperationBlocked ? 'Restringido' : 'Disponible'}
          />
        </div>

        {activeFilterLabels.length ? (
          <div className="chip-row trip-filter-chip-row">
            {activeFilterLabels.map((label) => (
              <span key={label} className="status-pill status-pill-neutral">
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </article>

      <DisclosurePanel
        defaultOpen={activeFiltersCount > 0}
        meta={activeFiltersCount > 0 ? `${activeFiltersCount} activos` : 'Opcional'}
        title="Ajustar busqueda"
      >
        <TripFiltersPanel
          isSubmitting={isFiltering}
          onApply={onApplyFilters}
          onChange={onFilterChange}
          onReset={onResetFilters}
          values={filterFormValues}
        />
      </DisclosurePanel>

      <article className="panel panel-stack trips-stream-panel">
        <div className="trip-discover-stream-head">
          <div className="section-heading">
            <h2 className="panel-title">Viajes disponibles</h2>
            <p className="section-heading-meta">{visibleAvailableTrips.length} resultados</p>
          </div>
          <div className="chip-row">
            <StatusPill
              label={`${discoverableTripsWithSeatsCount} con cupos`}
              tone={discoverableTripsWithSeatsCount > 0 ? 'success' : 'warning'}
            />
          </div>
        </div>

        {visibleAvailableTrips.length ? (
          <div className="list-stack">
            {visibleAvailableTrips.map((trip) => {
              const draft = requestDrafts[trip.id] ?? EMPTY_REQUEST_DRAFT;
              const hasActiveRequest = myRequests.some(
                (request) =>
                  request.tripId === trip.id
                  && (request.status === TripRequestStatus.Pending
                    || request.status === TripRequestStatus.Accepted),
              );
              const canSubmitRequest = canCreateRequestForTrip(trip, hasActiveRequest);
              const requestState = getRequestStateLabel(
                trip,
                hasActiveRequest,
                isPassengerOperationBlocked,
              );

              return (
                <TripOverviewCard
                  key={trip.id}
                  emphasis
                  showDriver
                  trip={trip}
                >
                  <div className="trip-request-composer-stack">
                    <div className="chip-row trip-request-composer-pills">
                      <StatusPill label={requestState.label} tone={requestState.tone} />
                      <StatusPill
                        label={
                          trip.routeMode === TripRouteMode.PlannedDetour
                            ? 'Desvio permitido'
                            : 'Ruta directa'
                        }
                        tone="neutral"
                      />
                      <StatusPill
                        label={`${trip.availableSeats} de ${trip.seatCount} cupos`}
                        tone={trip.availableSeats > 0 ? 'success' : 'warning'}
                      />
                    </div>

                    <DisclosurePanel
                      className="trip-request-composer"
                      defaultOpen={trip.routeMode === TripRouteMode.PlannedDetour}
                      meta={
                        trip.routeMode === TripRouteMode.PlannedDetour
                          ? 'Personalizable'
                          : 'Rapida'
                      }
                      title={hasActiveRequest ? 'Solicitud registrada' : 'Solicitar este viaje'}
                    >
                      <div className="trip-request-composer-grid">
                        {trip.routeMode === TripRouteMode.PlannedDetour ? (
                          <div className="trip-request-detour-panel">
                            <div className="trip-request-detour-head">
                              <strong>Puntos personalizados</strong>
                              <span>Recogida y destino</span>
                            </div>
                            <div className="form-grid form-grid-4 compact-grid">
                              <InputField
                                label="Lat. recogida"
                                onChange={(event) =>
                                  onRequestDraftChange(
                                    trip.id,
                                    'requestedPickupLatitude',
                                    event.target.value,
                                  )}
                                step="any"
                                type="number"
                                value={draft.requestedPickupLatitude}
                              />
                              <InputField
                                label="Long. recogida"
                                onChange={(event) =>
                                  onRequestDraftChange(
                                    trip.id,
                                    'requestedPickupLongitude',
                                    event.target.value,
                                  )}
                                step="any"
                                type="number"
                                value={draft.requestedPickupLongitude}
                              />
                              <InputField
                                label="Lat. destino"
                                onChange={(event) =>
                                  onRequestDraftChange(
                                    trip.id,
                                    'requestedDropoffLatitude',
                                    event.target.value,
                                  )}
                                step="any"
                                type="number"
                                value={draft.requestedDropoffLatitude}
                              />
                              <InputField
                                label="Long. destino"
                                onChange={(event) =>
                                  onRequestDraftChange(
                                    trip.id,
                                    'requestedDropoffLongitude',
                                    event.target.value,
                                  )}
                                step="any"
                                type="number"
                                value={draft.requestedDropoffLongitude}
                              />
                            </div>
                          </div>
                        ) : null}

                        <TextareaField
                          label="Mensaje"
                          onChange={(event) =>
                            onRequestDraftChange(trip.id, 'requestMessage', event.target.value)
                          }
                          placeholder="Comentario opcional para el conductor"
                          rows={3}
                          value={draft.requestMessage}
                        />

                        <div className="button-row trip-request-composer-footer">
                          <Button
                            disabled={
                              !canSubmitRequest
                              || isMutatingRequestId === trip.id
                              || isPassengerOperationBlocked
                            }
                            onClick={() => onCreateRequest(trip)}
                          >
                            {hasActiveRequest
                              ? 'Ya solicitaste este viaje'
                              : isPassengerOperationBlocked
                                ? 'Solicitud restringida'
                                : trip.status === TripStatus.Full
                                  ? 'Sin cupos disponibles'
                                  : 'Solicitar cupo'}
                          </Button>
                        </div>
                      </div>
                    </DisclosurePanel>
                  </div>
                </TripOverviewCard>
              );
            })}
          </div>
        ) : (
          <TripsEditorialEmptyState
            actionLabel={activeFiltersCount > 0 ? 'Limpiar filtros' : undefined}
            eyebrow="Explorar"
            onAction={activeFiltersCount > 0 ? onResetFilters : undefined}
            title="No hay viajes que encajen con estos filtros"
          />
        )}
      </article>
    </section>
  );
}

function DiscoverSummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'warning';
}) {
  return (
    <div className={`trip-discover-insight-card trip-discover-insight-card-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getRequestStateLabel(
  trip: TripRecord,
  hasActiveRequest: boolean,
  isPassengerOperationBlocked: boolean,
): {
  label: string;
  tone: 'neutral' | 'success' | 'warning';
} {
  if (hasActiveRequest) {
    return {
      label: 'Solicitud activa',
      tone: 'success',
    };
  }

  if (isPassengerOperationBlocked) {
    return {
      label: 'Operacion restringida',
      tone: 'warning',
    };
  }

  if (trip.status === TripStatus.Full || trip.availableSeats <= 0) {
    return {
      label: 'Sin cupos',
      tone: 'warning',
    };
  }

  return {
    label: 'Disponible',
    tone: 'neutral',
  };
}
