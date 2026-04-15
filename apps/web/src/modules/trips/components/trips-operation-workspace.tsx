import {
  DriverLicenseStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { DisclosurePanel } from '../../../components/ui/disclosure-panel';
import { StatusPill } from '../../../components/ui/status-pill';
import {
  canStartTripNow,
  getCancellationTimingLabel,
  getCancellationTimingTone,
  getTripCompletionOverdueMessage,
  getTripStartAvailabilityMessage,
} from '../lib/trip-labels';
import type { LatestTripRouteTemplate, TripRecord } from '../types/trip';
import type { VehicleRecord } from '../../vehicles/types/vehicle';
import { TripCreationForm } from './trip-creation-form';
import { TripsEditorialEmptyState } from './trips-editorial-empty-state';
import { TripOverviewCard } from './trip-overview-card';
import { TripsWorkspaceSkeleton } from './trips-workspace-skeleton';
import type { TripFormValues } from './trips-workspace.types';

type TripsOperationWorkspaceProps = {
  myTrips: TripRecord[];
  licenseStatus: DriverLicenseStatus;
  blocksDriver: boolean;
  isMutatingTripId: string | null;
  onTripAction: (tripId: string, action: 'publish' | 'start' | 'complete' | 'cancel') => void;
  isCreateTripPanelOpen: boolean;
  onCreateTripPanelOpenChange: (nextOpen: boolean) => void;
  isLoadingLatestRoute: boolean;
  latestRouteTemplate: LatestTripRouteTemplate | null;
  canCreateTrips: boolean;
  isCreatingTrip: boolean;
  tripForm: TripFormValues;
  activeVehicles: VehicleRecord[];
  onTripFormChange: (field: keyof TripFormValues, value: string) => void;
  onCreateTrip: (event: React.FormEvent<HTMLFormElement>) => void;
  onUseLatestRoute: () => void;
  isRefreshingData?: boolean;
  onOpenCreateTrip: () => void;
};

export function TripsOperationWorkspace({
  myTrips,
  licenseStatus,
  blocksDriver,
  isMutatingTripId,
  onTripAction,
  isCreateTripPanelOpen,
  onCreateTripPanelOpenChange,
  isLoadingLatestRoute,
  latestRouteTemplate,
  canCreateTrips,
  isCreatingTrip,
  tripForm,
  activeVehicles,
  onTripFormChange,
  onCreateTrip,
  onUseLatestRoute,
  isRefreshingData = false,
  onOpenCreateTrip,
}: TripsOperationWorkspaceProps) {
  return (
    <section className="trips-workspace-grid trips-operation-stack">
      {isRefreshingData ? <TripsWorkspaceSkeleton variant="operation" /> : null}

      <article className="panel panel-stack trips-stream-panel">
        <div className="section-heading">
          <h2 className="panel-title">Mis viajes</h2>
          <p className="section-heading-meta">{myTrips.length} resultados</p>
        </div>
        {myTrips.length ? (
          <div className="list-stack">
            {myTrips.map((trip) => {
              const startAvailabilityMessage = getTripStartAvailabilityMessage(
                trip.departureAt,
                trip.estimatedArrivalAt,
              );
              const completionOverdueMessage = getTripCompletionOverdueMessage(
                trip.status,
                trip.estimatedArrivalAt,
              );

              return (
                <TripOverviewCard
                  key={trip.id}
                  helperContent={
                    <>
                      {trip.status === TripStatus.Cancelled && trip.cancellationTiming ? (
                        <StatusPill
                          label={getCancellationTimingLabel(trip.cancellationTiming) ?? 'Cancelacion'}
                          tone={getCancellationTimingTone(trip.cancellationTiming)}
                        />
                      ) : null}
                      {licenseStatus === DriverLicenseStatus.Expired
                      && (trip.status === TripStatus.Draft
                        || trip.status === TripStatus.Published
                        || trip.status === TripStatus.Full) ? (
                        <p className="panel-text">
                          No puedes publicar ni iniciar este viaje mientras tu licencia siga vencida.
                        </p>
                      ) : null}
                      {(trip.status === TripStatus.Published || trip.status === TripStatus.Full)
                      && startAvailabilityMessage ? (
                        <p className="panel-text">{startAvailabilityMessage}</p>
                      ) : null}
                      {completionOverdueMessage ? (
                        <p className="panel-text">
                          {completionOverdueMessage} Revisalo cuanto antes para evitar inconsistencias operativas.
                        </p>
                      ) : null}
                    </>
                  }
                  trip={trip}
                >
                  <div className="button-row">
                    {trip.status === TripStatus.Draft ? (
                      <Button
                        disabled={
                          isMutatingTripId === trip.id
                          || licenseStatus === DriverLicenseStatus.Expired
                          || blocksDriver
                        }
                        onClick={() => onTripAction(trip.id, 'publish')}
                        variant="primary"
                      >
                        Publicar
                      </Button>
                    ) : null}
                    {(trip.status === TripStatus.Published || trip.status === TripStatus.Full) ? (
                      <Button
                        disabled={
                          isMutatingTripId === trip.id
                          || licenseStatus === DriverLicenseStatus.Expired
                          || blocksDriver
                          || !canStartTripNow(trip.departureAt, trip.estimatedArrivalAt)
                        }
                        onClick={() => onTripAction(trip.id, 'start')}
                        title={startAvailabilityMessage ?? undefined}
                        variant="secondary"
                      >
                        Iniciar
                      </Button>
                    ) : null}
                    {trip.status === TripStatus.InProgress ? (
                      <Button
                        disabled={isMutatingTripId === trip.id}
                        onClick={() => onTripAction(trip.id, 'complete')}
                        variant="secondary"
                      >
                        Finalizar
                      </Button>
                    ) : null}
                    {trip.status !== TripStatus.Completed
                    && trip.status !== TripStatus.InProgress
                    && trip.status !== TripStatus.Cancelled ? (
                      <Button
                        disabled={isMutatingTripId === trip.id}
                        onClick={() => onTripAction(trip.id, 'cancel')}
                        variant="ghost"
                      >
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                </TripOverviewCard>
              );
            })}
          </div>
        ) : (
          <TripsEditorialEmptyState
            actionLabel="Crear mi primer viaje"
            description="Cuando registres tu primer viaje, aqui veras su progreso y podras gestionarlo en tiempo real."
            eyebrow="Operacion"
            onAction={onOpenCreateTrip}
            title="Tu panel de conduccion aun esta vacio"
          />
        )}
      </article>

      <DisclosurePanel
        className="trip-create-disclosure"
        defaultOpen={false}
        onOpenChange={onCreateTripPanelOpenChange}
        open={isCreateTripPanelOpen}
        description="Registra viajes nuevos cuando tengas vehiculo activo y estado aprobado."
        meta={
          isLoadingLatestRoute
            ? 'Cargando referencia'
            : latestRouteTemplate
              ? 'Incluye ultima ruta'
              : canCreateTrips
                ? 'Nuevo borrador'
                : 'Bloqueado'
        }
        title="Crear viaje"
      >
        <TripCreationForm
          disabled={!canCreateTrips}
          errorMessage={null}
          isSubmitting={isCreatingTrip}
          latestRouteTemplate={latestRouteTemplate}
          onChange={onTripFormChange}
          onSubmit={onCreateTrip}
          onUseLatestRoute={onUseLatestRoute}
          successMessage={null}
          values={tripForm}
          vehicles={activeVehicles}
        />
      </DisclosurePanel>
    </section>
  );
}
