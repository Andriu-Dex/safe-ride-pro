import { StatusPill } from '../../../components/ui/status-pill';
import {
  getLuggagePolicyLabel,
  getVehicleTypeLabel,
} from '../../vehicles/lib/vehicle-labels';
import {
  getTripRouteModeLabel,
  getTripStatusLabel,
  getTripStatusTone,
} from '../lib/trip-labels';
import type { TripRecord } from '../types/trip';

type TripOverviewCardProps = {
  trip: TripRecord;
  showDriver?: boolean;
  emphasis?: boolean;
  helperContent?: React.ReactNode;
  children?: React.ReactNode;
};

export function TripOverviewCard({
  trip,
  showDriver = false,
  emphasis = false,
  helperContent,
  children,
}: TripOverviewCardProps) {
  return (
    <article
      className={['trip-overview-card', emphasis ? 'trip-overview-card-emphasis' : null]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="trip-overview-header">
        <div className="trip-overview-route-block">
          <span className="trip-overview-kicker">Ruta</span>
          <h3 className="trip-overview-route">
            {trip.originLabel} <span aria-hidden="true">&rarr;</span> {trip.destinationLabel}
          </h3>
        </div>
        <StatusPill
          label={getTripStatusLabel(trip.status)}
          tone={getTripStatusTone(trip.status)}
        />
      </div>

      <div className="trip-overview-grid">
        {showDriver ? (
          <TripOverviewStat label="Conductor" value={trip.driverFullName} />
        ) : null}
        <TripOverviewStat label="Salida" value={formatTripDeparture(trip.departureAt)} />
        <TripOverviewStat
          label="Vehiculo"
          secondaryValue={trip.vehiclePlate}
          value={trip.vehicleDisplayName}
        />
        <TripOverviewStat
          label="Modalidad"
          value={getTripRouteModeLabel(trip.routeMode)}
        />
        <TripOverviewStat label="Cupos" value={`${trip.availableSeats}/${trip.seatCount}`} />
        <TripOverviewStat
          label="Tipo"
          value={getVehicleTypeLabel(trip.vehicleTypeSnapshot)}
        />
        <TripOverviewStat
          label="Equipaje"
          value={getLuggagePolicyLabel(trip.luggagePolicySnapshot)}
        />
        <TripOverviewStat
          label="Precio base"
          value={formatCurrency(trip.basePriceReference)}
        />
      </div>

      {trip.detourSurchargeReference ? (
        <div className="trip-overview-highlight">
          <strong>Recargo por desvio:</strong> {formatCurrency(trip.detourSurchargeReference)}
        </div>
      ) : null}

      {trip.notes ? (
        <p className="trip-overview-note">
          <strong>Observaciones:</strong> {trip.notes}
        </p>
      ) : null}

      {helperContent ? <div className="trip-overview-helper">{helperContent}</div> : null}
      {children ? <div className="trip-overview-actions">{children}</div> : null}
    </article>
  );
}

function TripOverviewStat({
  label,
  value,
  secondaryValue,
}: {
  label: string;
  value: string;
  secondaryValue?: string;
}) {
  return (
    <div className="trip-overview-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {secondaryValue ? <small>{secondaryValue}</small> : null}
    </div>
  );
}

function formatTripDeparture(value: string): string {
  const date = new Date(value);
  const formattedDate = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const formattedTime = new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  return `${formattedDate} | ${formattedTime}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}
