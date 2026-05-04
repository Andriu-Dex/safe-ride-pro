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
  const routeReady = Boolean(
    tripForm.originLabel.trim() &&
      tripForm.destinationLabel.trim() &&
      tripForm.originLatitude.trim() &&
      tripForm.originLongitude.trim() &&
      tripForm.destinationLatitude.trim() &&
      tripForm.destinationLongitude.trim(),
  );
  const scheduleReady = Boolean(tripForm.departureAt && tripForm.estimatedArrivalAt);
  const commercialReady = Boolean(tripForm.seatCount && tripForm.basePriceReference);
  const completedChecklistItems = [
    Boolean(selectedVehicle),
    routeReady,
    scheduleReady,
    commercialReady,
  ].filter(Boolean).length;
  const draftTitle =
    tripForm.originLabel.trim() && tripForm.destinationLabel.trim()
      ? `${tripForm.originLabel.trim()} -> ${tripForm.destinationLabel.trim()}`
      : 'Tu nuevo trayecto aparecera aqui';
  const estimatedDuration = getDurationLabel(tripForm.departureAt, tripForm.estimatedArrivalAt);
  const referenceFare = getReferenceFare(tripForm.basePriceReference, tripForm.detourSurchargeReference, tripForm.routeMode);

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
    <section className={styles.pageShell}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <section className={`${styles.hero} ${styles.reveal}`}>
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
          <StatusPill
            label={getDriverStatusLabel(driverStatus)}
            tone={getDriverStatusTone(driverStatus)}
          />
          {trustSummary ? (
            <StatusPill
              label={getVisibleReputationStateLabel(trustSummary.visibleReputationState)}
              tone={getVisibleReputationTone(trustSummary.visibleReputationState)}
            />
          ) : null}
          {trustSummary ? (
            <StatusPill
              label={getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)}
              tone={getAdministrativeRiskTone(trustSummary.administrativeRiskState)}
            />
          ) : null}
          <StatusPill
            label={canCreateTrips ? 'Listo para crear' : 'Requiere revision'}
            tone={canCreateTrips ? 'success' : 'warning'}
          />
        </div>

          <div className={styles.heroHighlights}>
            <article className={styles.heroHighlight}>
              <span>Vehiculos</span>
              <strong>{activeVehicles.length}</strong>
            </article>
          <article className={styles.heroHighlight}>
            <span>Ruta reciente</span>
            <strong>{latestRouteTemplate ? 'Disponible' : 'Sin historial'}</strong>
          </article>
            <article className={styles.heroHighlight}>
              <span>Formulario</span>
              <strong>{completedChecklistItems}/4</strong>
            </article>
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

        <aside className={styles.sideColumn}>
          <article className={`${styles.sideCard} ${styles.revealSoft}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.kicker}>Vista previa</p>
                <h2>Resumen del viaje</h2>
              </div>
              <span className={styles.previewMeta}>{completedChecklistItems}/4</span>
            </div>

            <div className={styles.previewCard}>
              <div className={styles.previewHeadline}>
                <h3 className={styles.previewTitle}>{draftTitle}</h3>
                <p className={styles.previewRoute}>
                  {selectedVehicle
                    ? `${getVehicleLabel(selectedVehicle)} | ${selectedVehicle.plate}`
                    : 'Selecciona un vehiculo para empezar'}
                </p>
              </div>

              <div className={styles.previewMetrics}>
                <JourneyPreviewMetric
                  label="Salida"
                  value={tripForm.departureAt ? formatDateTime(tripForm.departureAt) : 'Pendiente'}
                />
                <JourneyPreviewMetric
                  label="Duracion"
                  value={estimatedDuration}
                />
                <JourneyPreviewMetric
                  label="Cupos"
                  value={tripForm.seatCount || 'Pendiente'}
                />
                <JourneyPreviewMetric
                  label="Referencia"
                  value={referenceFare}
                />
              </div>
            </div>
          </article>

          <article className={`${styles.sideCard} ${styles.revealSoft}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.kicker}>Preparacion</p>
                <h2>Requisitos</h2>
              </div>
              <StatusPill
                label={canCreateTrips ? 'Listo' : 'Pendiente'}
                tone={canCreateTrips ? 'success' : 'warning'}
              />
            </div>

            <div className={styles.readinessList}>
              <div className={styles.readinessItem}>
                <StatusPill label="Conductor" tone={driverStatus === DriverVerificationStatus.Approved ? 'success' : 'warning'} />
                  <div className={styles.readinessCopy}>
                    <strong>Perfil operativo</strong>
                    <span>{driverStatus === DriverVerificationStatus.Approved ? 'Aprobado' : 'Pendiente'}</span>
                  </div>
                </div>
              <div className={styles.readinessItem}>
                <StatusPill label="Licencia" tone={licenseStatus === DriverLicenseStatus.Expired ? 'warning' : 'success'} />
                <div className={styles.readinessCopy}>
                  <strong>Licencia</strong>
                  <span>{licenseStatus === DriverLicenseStatus.Expired ? 'Vencida' : 'Vigente'}</span>
                </div>
              </div>
              <div className={styles.readinessItem}>
                <StatusPill label="Vehiculos" tone={activeVehicles.length > 0 ? 'success' : 'warning'} />
                <div className={styles.readinessCopy}>
                  <strong>Vehiculos activos</strong>
                  <span>{activeVehicles.length > 0 ? `${activeVehicles.length} disponible(s)` : 'Sin vehiculos activos'}</span>
                </div>
              </div>
                <div className={styles.readinessItem}>
                  <StatusPill label="Permiso" tone={trustRestrictions.blocksDriver ? 'warning' : 'success'} />
                  <div className={styles.readinessCopy}>
                    <strong>Operacion</strong>
                    <span>{trustRestrictions.blocksDriver ? 'Con restriccion activa' : 'Sin bloqueos'}</span>
                  </div>
                </div>
            </div>

            {!canCreateTrips ? (
              <div className={styles.sideLinks}>
                <Link className={styles.inlineLink} href="/conductor">
                  Revisar conductor
                </Link>
                <Link className={styles.inlineLink} href="/vehiculos">
                  Gestionar vehiculos
                </Link>
              </div>
            ) : null}
          </article>

          <article className={`${styles.sideCard} ${styles.revealSoft}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.kicker}>Contexto</p>
                <h2>Resumen</h2>
              </div>
              <StatusPill
                label={tripForm.routeMode === TripRouteMode.PlannedDetour ? 'Con desvio' : 'Directo'}
                tone="neutral"
              />
            </div>

            <div className={styles.signalGrid}>
              <article className={styles.signalTile}>
                <span className={styles.miniLabel}>Modo</span>
                <strong className={styles.signalValue}>{tripForm.routeMode === TripRouteMode.PlannedDetour ? 'Desvio' : 'Directo'}</strong>
                <p className={styles.signalCaption}>Ruta seleccionada</p>
              </article>
              <article className={styles.signalTile}>
                <span className={styles.miniLabel}>Tarifa</span>
                <strong className={styles.signalValue}>{referenceFare}</strong>
                <p className={styles.signalCaption}>Referencia actual</p>
              </article>
              <article className={styles.signalTile}>
                <span className={styles.miniLabel}>Horario</span>
                <strong className={styles.signalValue}>{scheduleReady ? 'Listo' : 'Pendiente'}</strong>
                <p className={styles.signalCaption}>Salida y llegada</p>
              </article>
              <article className={styles.signalTile}>
                <span className={styles.miniLabel}>Ruta</span>
                <strong className={styles.signalValue}>{routeReady ? 'Lista' : 'Pendiente'}</strong>
                <p className={styles.signalCaption}>Origen y destino</p>
              </article>
            </div>
          </article>

          <article className={`${styles.sideCard} ${styles.revealSoft}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.kicker}>Ruta reciente</p>
                <h2>Acceso rapido</h2>
              </div>
              <StatusPill label={latestRouteTemplate ? 'Disponible' : 'Sin historial'} tone="neutral" />
            </div>

            {latestRouteTemplate ? (
              <div className={styles.templateTile}>
                <strong>
                  {latestRouteTemplate.originLabel} {'->'} {latestRouteTemplate.destinationLabel}
                </strong>
                <p className={styles.metricText}>
                  {latestRouteTemplate.vehicleDisplayName} | {latestRouteTemplate.vehiclePlate}
                </p>
                <p className={styles.metricText}>
                  Ultimo uso: {formatDateTime(latestRouteTemplate.departureAt)}
                </p>
                <div className={styles.templateActions}>
                  <button className={styles.actionBtnSecondary} disabled={!canCreateTrips} onClick={handleUseLatestRoute} type="button">
                    Cargar ruta
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.emptyNote}>
                <strong>Aun no tienes una ruta reciente</strong>
                <span>Cuando completes un viaje podras reutilizar su ruta.</span>
              </div>
            )}
          </article>
        </aside>
      </section>
    </section>
  );
}

function JourneyPreviewMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.previewMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getVehicleLabel(vehicle: VehicleRecord): string {
  return `${vehicle.customBrandName ?? vehicle.brandName ?? 'Marca'} ${vehicle.customModelName ?? vehicle.modelName ?? 'Modelo'}`.trim();
}

function getDurationLabel(
  departureAt: string,
  estimatedArrivalAt: string,
): string {
  if (!departureAt || !estimatedArrivalAt) {
    return 'Pendiente';
  }

  const departureDate = new Date(departureAt);
  const arrivalDate = new Date(estimatedArrivalAt);

  if (
    Number.isNaN(departureDate.getTime()) ||
    Number.isNaN(arrivalDate.getTime()) ||
    arrivalDate <= departureDate
  ) {
    return 'Pendiente';
  }

  const minutes = Math.round((arrivalDate.getTime() - departureDate.getTime()) / 60_000);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

function getReferenceFare(
  basePriceReference: string,
  detourSurchargeReference: string,
  routeMode: TripRouteMode,
): string {
  const basePrice = Number.parseFloat(basePriceReference);
  const detourSurcharge = Number.parseFloat(detourSurchargeReference);

  if (Number.isNaN(basePrice)) {
    return 'Pendiente';
  }

  if (routeMode === TripRouteMode.PlannedDetour && !Number.isNaN(detourSurcharge)) {
    return `$${(basePrice + detourSurcharge).toFixed(2)}`;
  }

  return `$${basePrice.toFixed(2)}`;
}
