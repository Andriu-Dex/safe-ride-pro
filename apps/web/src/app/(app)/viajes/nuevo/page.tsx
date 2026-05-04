'use client';

import Link from 'next/link';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  TripRouteMode,
} from '@saferidepro/shared-types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { ApiError } from '../../../../lib/api-client';
import { persistToast } from '../../../../components/ui/flash-toast';
import { OperationalAccessCard } from '../../../../components/ui/operational-access-card';
import { StatusPill } from '../../../../components/ui/status-pill';
import { ToastStack, type ToastItem } from '../../../../components/ui/toast-stack';
import { useAuth } from '../../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../../modules/auth/lib/operational-context';
import {
  getDriverStatusLabel,
  getDriverStatusTone,
} from '../../../../modules/driver/lib/driver-status';
import {
  createTrip,
  getLatestTripRouteTemplate,
} from '../../../../modules/trips/lib/trip-api';
import { TripCreationForm } from '../../../../modules/trips/components/trip-creation-form';
import {
  EMPTY_TRIP_FORM,
  type TripFormValues,
} from '../../../../modules/trips/components/trips-workspace.types';
import { getVehicleOverview } from '../../../../modules/vehicles/lib/vehicle-api';
import type { VehicleOverview } from '../../../../modules/vehicles/types/vehicle';
import { getCurrentUserTrustSummary } from '../../../../modules/users/lib/user-api';
import {
  getAdministrativeRiskStateLabel,
  getAdministrativeRiskTone,
  getTrustRestrictions,
  getVisibleReputationStateLabel,
  getVisibleReputationTone,
} from '../../../../modules/users/lib/trust-labels';
import type { TrustSummary } from '../../../../modules/users/types/trust-summary';
import type { LatestTripRouteTemplate } from '../../../../modules/trips/types/trip';
import type { VehicleRecord } from '../../../../modules/vehicles/types/vehicle';
import styles from './page.module.css';

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

function toIsoString(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
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

export default function NewTripPage() {
  const router = useRouter();
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);

  const [vehicleOverview, setVehicleOverview] = useState<VehicleOverview | null>(null);
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [latestRouteTemplate, setLatestRouteTemplate] = useState<LatestTripRouteTemplate | null>(null);
  const [tripForm, setTripForm] = useState(EMPTY_TRIP_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [isRefreshingContext, setIsRefreshingContext] = useState(false);
  const [tripErrorMessage, setTripErrorMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((title: string, description: string, tone: ToastItem['tone']) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `trip-create-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const loadCreateContext = useCallback(async (accessToken: string) => {
    const [vehicleData, trustSummaryData, latestRoute] = await Promise.all([
      getVehicleOverview(accessToken),
      getCurrentUserTrustSummary(accessToken),
      getLatestTripRouteTemplate(accessToken).catch(() => null),
    ]);

    setVehicleOverview(vehicleData);
    setTrustSummary(trustSummaryData);
    setLatestRouteTemplate(latestRoute);
  }, []);

  const refreshCreateContext = useCallback(async (showSpinner = false) => {
    if (!authSession) {
      return;
    }

    if (showSpinner) {
      setIsRefreshingContext(true);
    }

    try {
      await loadCreateContext(authSession.accessToken);
      setTripErrorMessage(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setTripErrorMessage(getApiErrorMessage(error, 'No fue posible sincronizar el formulario de creacion.'));
    } finally {
      if (showSpinner) {
        setIsRefreshingContext(false);
      }
    }
  }, [authSession, loadCreateContext, refreshSession]);

  useEffect(() => {
    if (!tripErrorMessage) {
      return;
    }

    pushToast('Operacion no completada', tripErrorMessage, 'error');
    setTripErrorMessage(null);
  }, [pushToast, tripErrorMessage]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession || !operationalAccess.hasOperationalMembership) {
      setVehicleOverview(null);
      setTrustSummary(null);
      setLatestRouteTemplate(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      setTripErrorMessage(null);

      try {
        await loadCreateContext(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        setTripErrorMessage(getApiErrorMessage(error, 'No fue posible cargar el contexto para crear viajes.'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [
    authSession,
    isHydrated,
    loadCreateContext,
    operationalAccess.hasOperationalMembership,
    refreshSession,
  ]);

  const driverStatus =
    vehicleOverview?.membership?.effectiveDriverVerificationStatus
    ?? vehicleOverview?.membership?.driverVerificationStatus
    ?? DriverVerificationStatus.NotRequested;
  const licenseStatus = vehicleOverview?.membership?.licenseStatus ?? DriverLicenseStatus.Missing;
  const activeVehicles = (vehicleOverview?.vehicles ?? []).filter((vehicle) => vehicle.isActive);
  const trustRestrictions = getTrustRestrictions(trustSummary);
  const canCreateTrips =
    driverStatus === DriverVerificationStatus.Approved
    && licenseStatus !== DriverLicenseStatus.Expired
    && !trustRestrictions.blocksDriver
    && activeVehicles.length > 0;
  const selectedVehicle = activeVehicles.find((vehicle) => vehicle.id === tripForm.vehicleId) ?? null;

  const handleTripFormChange = (field: keyof TripFormValues, value: string) => {
    setTripForm((currentForm) => ({
      ...currentForm,
      [field]: value,
      ...(field === 'routeMode' && value === TripRouteMode.DirectRoute
        ? { detourSurchargeReference: '0' }
        : {}),
    }));
  };

  const handleResetTripForm = useCallback(() => {
    setTripForm(EMPTY_TRIP_FORM);
    setTripErrorMessage(null);
  }, []);

  const handleUseLatestRoute = () => {
    if (!latestRouteTemplate) {
      return;
    }

    const suggestedVehicle = activeVehicles.some((vehicle) => vehicle.id === latestRouteTemplate.vehicleId)
      ? latestRouteTemplate.vehicleId
      : '';

    setTripForm((currentForm) => ({
      ...currentForm,
      vehicleId: suggestedVehicle,
      routeMode: latestRouteTemplate.routeMode,
      originLabel: latestRouteTemplate.originLabel,
      destinationLabel: latestRouteTemplate.destinationLabel,
      originLatitude: latestRouteTemplate.originLatitude.toFixed(6),
      originLongitude: latestRouteTemplate.originLongitude.toFixed(6),
      destinationLatitude: latestRouteTemplate.destinationLatitude.toFixed(6),
      destinationLongitude: latestRouteTemplate.destinationLongitude.toFixed(6),
      seatCount: String(latestRouteTemplate.seatCount),
      basePriceReference: String(latestRouteTemplate.basePriceReference),
      detourSurchargeReference: String(latestRouteTemplate.detourSurchargeReference ?? 0),
      notes: latestRouteTemplate.notes ?? '',
      departureAt: currentForm.departureAt,
      estimatedArrivalAt: currentForm.estimatedArrivalAt,
    }));

    pushToast(
      'Ruta cargada',
      suggestedVehicle
        ? 'Se cargo tu ultima ruta. Ajusta fecha, hora o detalles antes de crear el nuevo viaje.'
        : 'Se cargo tu ultima ruta, pero necesitas elegir un vehiculo activo antes de crear el viaje.',
      'success',
    );
    setTripErrorMessage(null);
  };

  const handleCreateTrip = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authSession) {
      return;
    }

    if (!canCreateTrips) {
      setTripErrorMessage('No cumples los requisitos operativos para crear un viaje en este momento.');
      return;
    }

    setIsCreatingTrip(true);
    setTripErrorMessage(null);

    try {
      const response = await createTrip(authSession.accessToken, {
        vehicleId: tripForm.vehicleId,
        routeMode: tripForm.routeMode,
        originLabel: tripForm.originLabel,
        destinationLabel: tripForm.destinationLabel,
        originLatitude: Number.parseFloat(tripForm.originLatitude),
        originLongitude: Number.parseFloat(tripForm.originLongitude),
        destinationLatitude: Number.parseFloat(tripForm.destinationLatitude),
        destinationLongitude: Number.parseFloat(tripForm.destinationLongitude),
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

      await refreshCreateContext();
      setTripForm(EMPTY_TRIP_FORM);
      persistToast({
        title: 'Viaje creado',
        description: response.message,
        tone: 'success',
      });
      router.push('/viajes');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      const message = getApiErrorMessage(error, 'No fue posible crear el viaje.');
      setTripErrorMessage(message);
    } finally {
      setIsCreatingTrip(false);
    }
  };

  const getBadgeClass = (tone: string) => {
    switch (tone) {
      case 'success': return styles.heroBadgeSuccess;
      case 'warning': return styles.heroBadgeWarning;
      case 'danger': return styles.heroBadgeDanger;
      default: return styles.heroBadgeNeutral;
    }
  };

  if (isLoading) {
    return (
      <section className={styles.pageBackground}>
        <article className={`${styles.canvas} ${styles.canvasSmall}`}>
          <div aria-hidden="true" className={styles.loadingPulse} />
          <h2 className={styles.loadingTitle}>Preparando nuevo viaje</h2>
          <p className={styles.loadingText}>
            Estamos cargando tu contexto operativo.
          </p>
        </article>
      </section>
    );
  }

  if (!operationalAccess.hasOperationalMembership && operationalAccess.title && operationalAccess.message) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.pageBackground}>
          <article className={`${styles.canvas} ${styles.canvasSmall}`}>
            <div className={styles.lockedHeader}>
              <div>
                <p className={styles.kicker}>Nuevo viaje</p>
                <h1 className={styles.lockedTitle}>Operacion no disponible</h1>
              </div>
              <StatusPill label="Bloqueado" tone="warning" />
            </div>

            <OperationalAccessCard
              message={operationalAccess.message}
              title={operationalAccess.title}
            />
          </article>
        </section>
      </>
    );
  }

  return (
    <section className={styles.pageBackground}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <div className={`${styles.canvas} ${styles.revealSoft}`}>
        <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Viajes</p>
            <h1 className={styles.heroTitle}>Nuevo viaje</h1>
            <p className={styles.heroLead}>
              Define ruta, horario y cupos antes de publicarlo.
            </p>
          </div>

          <div className={styles.heroActions}>
            <button className={styles.heroBtnSecondary} onClick={() => router.push('/viajes')} type="button">
              Volver
            </button>
            {latestRouteTemplate ? (
              <button className={styles.heroBtnSecondary} disabled={!canCreateTrips} onClick={handleUseLatestRoute} type="button">
                Cargar ultima ruta
              </button>
            ) : null}
            <button
              className={styles.heroBtnGhost}
              disabled={isRefreshingContext}
              onClick={() => void refreshCreateContext(true)}
              type="button"
            >
              {isRefreshingContext ? 'Actualizando...' : 'Actualizar'}
            </button>
          </div>
        </div>

        <div className={styles.heroPills} aria-label="Estado de habilitacion para crear viajes">
          <span className={`${styles.heroBadge} ${getBadgeClass(getDriverStatusTone(driverStatus))}`}>
            {getDriverStatusLabel(driverStatus)}
          </span>
          {trustSummary ? (
            <span className={`${styles.heroBadge} ${getBadgeClass(getVisibleReputationTone(trustSummary.visibleReputationState))}`}>
              {getVisibleReputationStateLabel(trustSummary.visibleReputationState)}
            </span>
          ) : null}
          {trustSummary ? (
            <span className={`${styles.heroBadge} ${getBadgeClass(getAdministrativeRiskTone(trustSummary.administrativeRiskState))}`}>
              {getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)}
            </span>
          ) : null}
          <span className={`${styles.heroBadge} ${getBadgeClass(canCreateTrips ? 'success' : 'warning')}`}>
            {canCreateTrips ? 'Listo para crear' : 'Requiere revision'}
          </span>
        </div>
      </section>

      <section className={styles.mainGrid}>
        <div className={styles.contentColumn}>
          <section className={`${styles.mainSurface} ${styles.reveal}`}>
            <TripCreationForm
              disabled={!canCreateTrips}
              isSubmitting={isCreatingTrip}
              latestRouteTemplate={latestRouteTemplate}
              onChange={handleTripFormChange}
              onReset={handleResetTripForm}
              onSubmit={handleCreateTrip}
              onUseLatestRoute={handleUseLatestRoute}
              values={tripForm}
              vehicles={activeVehicles}
            />
          </section>
        </div>
      </section>
      </div>
    </section>
  );
}
