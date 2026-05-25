'use client';

import Link from 'next/link';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  TripRouteMode,
} from '@saferidepro/shared-types';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { persistToast } from '../../../../../components/ui/flash-toast';
import { Button } from '../../../../../components/ui/button';
import { StatusPill } from '../../../../../components/ui/status-pill';
import { ToastStack, type ToastItem } from '../../../../../components/ui/toast-stack';
import { ApiError } from '../../../../../lib/api-client';
import { useAuth } from '../../../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../../../modules/auth/lib/operational-context';
import { TripCreationForm } from '../../../../../modules/trips/components/trip-creation-form';
import {
  EMPTY_TRIP_FORM,
  type TripFormValues,
} from '../../../../../modules/trips/components/trips-workspace.types';
import {
  getTripById,
  updateTrip,
} from '../../../../../modules/trips/lib/trip-api';
import type { TripDetailRecord } from '../../../../../modules/trips/types/trip';
import { getVehicleOverview } from '../../../../../modules/vehicles/lib/vehicle-api';
import type { VehicleOverview, VehicleRecord } from '../../../../../modules/vehicles/types/vehicle';
import styles from './page.module.css';

function getApiErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

function toIsoString(localDateTime: string) {
  return new Date(localDateTime).toISOString();
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function mapTripToFormValues(trip: TripDetailRecord): TripFormValues {
  return {
    vehicleId: trip.vehicleId,
    routeMode: trip.routeMode,
    originLabel: trip.originLabel,
    destinationLabel: trip.destinationLabel,
    originLatitude: trip.originLatitude?.toFixed(6) ?? '',
    originLongitude: trip.originLongitude?.toFixed(6) ?? '',
    destinationLatitude: trip.destinationLatitude?.toFixed(6) ?? '',
    destinationLongitude: trip.destinationLongitude?.toFixed(6) ?? '',
    routePathJson: trip.routePath ? JSON.stringify(trip.routePath) : '',
    routeDistanceMeters: trip.routeDistanceMeters?.toString() ?? '',
    routeDurationSeconds: trip.routeDurationSeconds?.toString() ?? '',
    departureAt: toLocalDateTimeInput(trip.departureAt),
    estimatedArrivalAt: toLocalDateTimeInput(trip.estimatedArrivalAt),
    seatCount: String(trip.seatCount),
    basePriceReference: String(trip.basePriceReference),
    detourSurchargeReference: String(trip.detourSurchargeReference ?? 0),
    notes: trip.notes ?? '',
  };
}

export default function EditTripPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = typeof params?.tripId === 'string' ? params.tripId : '';
  const router = useRouter();
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);

  const [trip, setTrip] = useState<TripDetailRecord | null>(null);
  const [vehicleOverview, setVehicleOverview] = useState<VehicleOverview | null>(null);
  const [tripForm, setTripForm] = useState<TripFormValues>(EMPTY_TRIP_FORM);
  const [initialForm, setInitialForm] = useState<TripFormValues>(EMPTY_TRIP_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pushToast = useCallback((title: string, description: string, tone: ToastItem['tone']) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `trip-edit-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const loadPage = useCallback(async () => {
    if (!authSession || !tripId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [tripData, vehicleData] = await Promise.all([
        getTripById(authSession.accessToken, tripId),
        getVehicleOverview(authSession.accessToken),
      ]);

      const mappedForm = mapTripToFormValues(tripData);

      setTrip(tripData);
      setVehicleOverview(vehicleData);
      setTripForm(mappedForm);
      setInitialForm(mappedForm);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible preparar la edicion del viaje.'));
    } finally {
      setIsLoading(false);
    }
  }, [authSession, refreshSession, tripId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession || !tripId) {
      setIsLoading(false);
      return;
    }

    void loadPage();
  }, [authSession, isHydrated, loadPage, tripId]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    pushToast('No fue posible continuar', errorMessage, 'error');
    setErrorMessage(null);
  }, [errorMessage, pushToast]);

  const activeVehicles = useMemo(
    () => (vehicleOverview?.vehicles ?? []).filter((vehicle) => vehicle.isActive),
    [vehicleOverview],
  );
  const canEdit = trip?.canEdit ?? false;
  const driverStatus =
    vehicleOverview?.membership?.effectiveDriverVerificationStatus
    ?? vehicleOverview?.membership?.driverVerificationStatus
    ?? DriverVerificationStatus.NotRequested;
  const licenseStatus = vehicleOverview?.membership?.licenseStatus ?? DriverLicenseStatus.Missing;
  const canOperate =
    operationalAccess.hasOperationalMembership &&
    driverStatus === DriverVerificationStatus.Approved &&
    licenseStatus !== DriverLicenseStatus.Expired;

  const handleTripFormChange = useCallback((field: keyof TripFormValues, value: string) => {
    setTripForm((currentForm) => ({
      ...currentForm,
      [field]: value,
      ...(field === 'routeMode' && value === TripRouteMode.DirectRoute
        ? { detourSurchargeReference: '0' }
        : {}),
    }));
  }, []);

  const handleResetTripForm = useCallback(() => {
    setTripForm(initialForm);
  }, [initialForm]);

  const handleUpdateTrip = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authSession || !trip) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await updateTrip(authSession.accessToken, trip.id, {
        vehicleId: tripForm.vehicleId,
        routeMode: tripForm.routeMode,
        originLabel: tripForm.originLabel,
        destinationLabel: tripForm.destinationLabel,
        originLatitude: Number.parseFloat(tripForm.originLatitude),
        originLongitude: Number.parseFloat(tripForm.originLongitude),
        destinationLatitude: Number.parseFloat(tripForm.destinationLatitude),
        destinationLongitude: Number.parseFloat(tripForm.destinationLongitude),
        routePath: parseRoutePathJson(tripForm.routePathJson),
        routeDistanceMeters: parseOptionalInteger(tripForm.routeDistanceMeters),
        routeDurationSeconds: parseOptionalInteger(tripForm.routeDurationSeconds),
        departureAt: toIsoString(tripForm.departureAt),
        estimatedArrivalAt: toIsoString(tripForm.estimatedArrivalAt),
        seatCount: Number.parseInt(tripForm.seatCount, 10),
        basePriceReference: Number.parseFloat(tripForm.basePriceReference),
        detourSurchargeReference:
          tripForm.routeMode === TripRouteMode.PlannedDetour
            ? Number.parseFloat(tripForm.detourSurchargeReference || '0')
            : undefined,
        notes: tripForm.notes || undefined,
      });

      persistToast({
        title: 'Viaje actualizado',
        description: response.message,
        tone: 'success',
      });
      router.push(`/viajes/${trip.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible actualizar el viaje.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className={styles.pageBackground}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <article className={`${styles.canvas} ${styles.canvasSmall}`}>
          <div aria-hidden="true" className={styles.loadingPulse} />
          <h1 className={styles.stateTitle}>Preparando edicion</h1>
          <p className={styles.stateText}>Estamos cargando el viaje y el contexto operativo.</p>
        </article>
      </section>
    );
  }

  if (!trip || !vehicleOverview || !canOperate || !canEdit) {
    return (
      <section className={styles.pageBackground}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <article className={`${styles.canvas} ${styles.canvasSmall}`}>
          <h1 className={styles.stateTitle}>Este viaje ya no se puede editar</h1>
          <p className={styles.stateText}>
            La edicion solo esta disponible antes del inicio y cuando no existen solicitudes
            activas o pasajeros confirmados.
          </p>
          <div className={styles.topActions}>
            {trip ? (
              <Link className="button button-secondary" href={`/viajes/${trip.id}`}>
                Ver detalle
              </Link>
            ) : null}
            <Link className="button button-ghost" href="/viajes">
              Volver a viajes
            </Link>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className={styles.pageBackground}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <article className={styles.canvas}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Viajes</p>
              <h1 className={styles.heroTitle}>Editar viaje</h1>
              <p className={styles.heroLead}>
                Ajusta ruta, horario o cupos antes de volver a publicarlo.
              </p>
            </div>

            <div className={styles.topActions}>
              <StatusPill label="Edicion habilitada" tone="success" />
              <Link className="button button-secondary" href={`/viajes/${trip.id}`}>
                Ver detalle
              </Link>
            </div>
          </div>
        </section>

        <div className={styles.formShell}>
          <TripCreationForm
            disabled={isSaving}
            headerKicker="Edicion"
            isSubmitting={isSaving}
            lead="Conserva la misma intencion del viaje, pero corrige datos operativos o de ruta."
            onChange={handleTripFormChange}
            onReset={handleResetTripForm}
            onSubmit={handleUpdateTrip}
            onUseRouteTemplate={() => undefined}
            pendingCopy="Corrige los datos obligatorios antes de guardar."
            readyCopy="Listo para guardar cambios"
            recentRouteTemplates={[]}
            submitLabel="Guardar cambios"
            submittingLabel="Guardando cambios..."
            title="Actualiza este trayecto"
            values={tripForm}
            vehicles={activeVehicles as VehicleRecord[]}
          />
        </div>
      </article>
    </section>
  );
}

function parseRoutePathJson(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(value) as unknown;

    if (!Array.isArray(parsedValue)) {
      return undefined;
    }

    const routePath = parsedValue
      .map((point) => {
        if (!point || typeof point !== 'object') {
          return null;
        }

        const candidate = point as { latitude?: unknown; longitude?: unknown };

        if (
          typeof candidate.latitude !== 'number' ||
          typeof candidate.longitude !== 'number' ||
          !Number.isFinite(candidate.latitude) ||
          !Number.isFinite(candidate.longitude)
        ) {
          return null;
        }

        return {
          latitude: candidate.latitude,
          longitude: candidate.longitude,
        };
      })
      .filter((point): point is { latitude: number; longitude: number } => point !== null);

    return routePath.length > 1 ? routePath : undefined;
  } catch {
    return undefined;
  }
}

function parseOptionalInteger(value: string): number | undefined {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : undefined;
}
