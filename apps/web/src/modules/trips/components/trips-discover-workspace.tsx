import { TripRequestStatus, TripRouteMode, TripStatus } from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { DisclosurePanel } from '../../../components/ui/disclosure-panel';
import { InputField } from '../../../components/ui/input-field';
import { TextareaField } from '../../../components/ui/textarea-field';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import { TripFiltersPanel } from './trip-filters-panel';
import { TripOverviewCard } from './trip-overview-card';
import { TripsEditorialEmptyState } from './trips-editorial-empty-state';
import { TripsWorkspaceSkeleton } from './trips-workspace-skeleton';
import type { TripFilters, TripRecord } from '../types/trip';
import { EMPTY_REQUEST_DRAFT, type TripRequestDraft } from './trips-workspace.types';

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
  onRequestDraftChange,
  onCreateRequest,
  canCreateRequestForTrip,
  isRefreshingData = false,
}: TripsDiscoverWorkspaceProps) {
  return (
    <section className="trips-discover-stack">
      {isRefreshingData ? <TripsWorkspaceSkeleton variant="discover" /> : null}

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

      <article className="panel panel-stack trip-search-summary-panel trips-summary-compact">
        <div className="section-heading">
          <h2 className="panel-title">Lectura rapida</h2>
          <p className="section-heading-meta">
            {visibleAvailableTrips.length} visibles · {discoverableTripsWithSeatsCount} con cupos
          </p>
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

      <article className="panel panel-stack trips-stream-panel">
        <div className="section-heading">
          <h2 className="panel-title">Viajes disponibles</h2>
          <p className="section-heading-meta">{visibleAvailableTrips.length} resultados</p>
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

              return (
                <TripOverviewCard
                  key={trip.id}
                  emphasis
                  helperContent={
                    trip.status === TripStatus.Full ? (
                      <p className="panel-text">Sin cupos.</p>
                    ) : null
                  }
                  showDriver
                  trip={trip}
                >
                  {trip.routeMode === TripRouteMode.PlannedDetour ? (
                    <div className="form-grid form-grid-4 compact-grid">
                      <InputField
                        label="Lat. recogida"
                        onChange={(event) =>
                          onRequestDraftChange(trip.id, 'requestedPickupLatitude', event.target.value)
                        }
                        type="number"
                        value={draft.requestedPickupLatitude}
                      />
                      <InputField
                        label="Long. recogida"
                        onChange={(event) =>
                          onRequestDraftChange(trip.id, 'requestedPickupLongitude', event.target.value)
                        }
                        type="number"
                        value={draft.requestedPickupLongitude}
                      />
                      <InputField
                        label="Lat. destino"
                        onChange={(event) =>
                          onRequestDraftChange(trip.id, 'requestedDropoffLatitude', event.target.value)
                        }
                        type="number"
                        value={draft.requestedDropoffLatitude}
                      />
                      <InputField
                        label="Long. destino"
                        onChange={(event) =>
                          onRequestDraftChange(trip.id, 'requestedDropoffLongitude', event.target.value)
                        }
                        type="number"
                        value={draft.requestedDropoffLongitude}
                      />
                    </div>
                  ) : null}

                  <TextareaField
                    label="Mensaje para el conductor"
                    onChange={(event) =>
                      onRequestDraftChange(trip.id, 'requestMessage', event.target.value)
                    }
                    placeholder="Comentario opcional para el conductor"
                    rows={3}
                    value={draft.requestMessage}
                  />

                  <div className="button-row">
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
                </TripOverviewCard>
              );
            })}
          </div>
        ) : (
          <TripsEditorialEmptyState
            eyebrow="Explorar"
            title="No hay viajes que encajen con estos filtros"
          />
        )}
      </article>
    </section>
  );
}
