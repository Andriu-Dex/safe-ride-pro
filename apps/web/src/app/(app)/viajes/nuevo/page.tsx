'use client';

import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  TripRouteMode,
} from '@saferidepro/shared-types';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { ApiError } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/button';
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
  const [tripSuccessMessage, setTripSuccessMessage] = useState<string | null>(null);
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
    setTripSuccessMessage(null);
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

    setTripSuccessMessage(
      suggestedVehicle
        ? 'Se cargo tu ultima ruta. Ajusta fecha, hora o detalles antes de crear el nuevo viaje.'
        : 'Se cargo tu ultima ruta, pero necesitas elegir un vehiculo activo antes de crear el viaje.',
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
    setTripSuccessMessage(null);

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
      setTripSuccessMessage(response.message);
      pushToast('Viaje creado', response.message, 'success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      const message = getApiErrorMessage(error, 'No fue posible crear el viaje.');
      setTripErrorMessage(message);
      pushToast('No se pudo crear el viaje', message, 'error');
    } finally {
      setIsCreatingTrip(false);
    }
  };

  if (isLoading) {
    return (
      <section className="loading-state compact-loading-state">
        <div className="loading-card">
          <div aria-hidden="true" className="loading-pulse" />
          <h1 className="panel-title">Preparando configuracion de viaje</h1>
          <p className="panel-text">
            Estamos cargando tus vehiculos, estado de confianza y ultima ruta para agilizar la creacion.
          </p>
        </div>
      </section>
    );
  }

  if (!operationalAccess.hasOperationalMembership && operationalAccess.title && operationalAccess.message) {
    return (
      <section className="journey-shell">
        <ToastStack onDismiss={dismissToast} toasts={toasts} />

        <section className="journey-hero journey-hero-blocked">
          <div className="journey-hero-copy">
            <p className="section-label">Centro de movilidad</p>
            <h1 className="journey-hero-title">Nuevo viaje</h1>
          </div>
          <div className="journey-hero-actions">
            <Button onClick={() => router.push('/viajes')} variant="secondary">
              Volver a viajes
            </Button>
            <StatusPill label="Operacion bloqueada" tone="warning" />
          </div>
        </section>

        <section className="empty-state">
          <OperationalAccessCard
            message={operationalAccess.message}
            title={operationalAccess.title}
          />
        </section>
      </section>
    );
  }

  return (
    <section className="journey-shell">
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <section className="journey-hero">
        <div className="journey-hero-copy">
          <p className="section-label">Centro de movilidad</p>
          <h1 className="journey-hero-title">Nuevo viaje</h1>
        </div>
        <div className="journey-hero-actions">
          <Button onClick={() => router.push('/viajes')} variant="secondary">
            Volver a viajes
          </Button>
          <Button
            disabled={isRefreshingContext}
            onClick={() => void refreshCreateContext(true)}
            variant="ghost"
          >
            {isRefreshingContext ? 'Actualizando...' : 'Actualizar contexto'}
          </Button>
        </div>
      </section>

      <section className="journey-hero-status-strip" aria-label="Estado de habilitacion para crear viajes">
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
      </section>

      <section className="journey-layout">
        <aside className="panel panel-stack journey-sidebar">
          <div className="journey-sidebar-section">
            <h2 className="panel-title">Resumen del viaje</h2>
          </div>

          <section className="journey-draft-preview">
            <p className="section-label">Vista previa</p>
            <strong className="journey-draft-preview-title">{draftTitle}</strong>
            <p className="journey-draft-preview-copy">
              {selectedVehicle
                ? `${getVehicleLabel(selectedVehicle)} | ${selectedVehicle.plate}`
                : 'Selecciona un vehiculo para empezar a estructurar el trayecto.'}
            </p>
            <div className="journey-draft-preview-metrics">
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
          </section>

          <div className="journey-readiness">
            <div className="journey-readiness-header">
              <strong>Estado de preparacion</strong>
              <StatusPill label={canCreateTrips ? 'Listo para crear' : 'Faltan requisitos'} tone={canCreateTrips ? 'success' : 'warning'} />
            </div>
            <ul className="journey-readiness-list">
              <li className="journey-readiness-item">
                <StatusPill label="Conductor" tone={driverStatus === DriverVerificationStatus.Approved ? 'success' : 'warning'} />
                <div>
                  <strong>Perfil operativo</strong>
                  <p>{driverStatus === DriverVerificationStatus.Approved ? 'Aprobado' : 'Pendiente'}</p>
                </div>
              </li>
              <li className="journey-readiness-item">
                <StatusPill label="Licencia" tone={licenseStatus === DriverLicenseStatus.Expired ? 'warning' : 'success'} />
                <div>
                  <strong>Estado de licencia</strong>
                  <p>{licenseStatus === DriverLicenseStatus.Expired ? 'Vencida' : 'Vigente'}</p>
                </div>
              </li>
              <li className="journey-readiness-item">
                <StatusPill label="Vehiculos" tone={activeVehicles.length > 0 ? 'success' : 'warning'} />
                <div>
                  <strong>Vehiculos activos</strong>
                  <p>{activeVehicles.length > 0 ? `${activeVehicles.length} disponible(s)` : 'Sin vehiculos'}</p>
                </div>
              </li>
              <li className="journey-readiness-item">
                <StatusPill label="Restricciones" tone={trustRestrictions.blocksDriver ? 'warning' : 'success'} />
                <div>
                  <strong>Riesgo administrativo</strong>
                  <p>{trustRestrictions.blocksDriver ? 'Con restriccion' : 'Sin bloqueos'}</p>
                </div>
              </li>
            </ul>
          </div>

          {latestRouteTemplate ? (
            <section className="journey-sidebar-note-card">
              <div className="journey-sidebar-route-suggestion">
                <strong>
                  {latestRouteTemplate.originLabel} {'->'} {latestRouteTemplate.destinationLabel}
                </strong>
                <p>Ultimo uso: {formatDateTime(latestRouteTemplate.departureAt)}</p>
              </div>
            </section>
          ) : null}
        </aside>

        <div className="journey-main">
          <section className="journey-main-surface journey-workspace-stage journey-workspace-stage-operation">
            <TripCreationForm
              disabled={!canCreateTrips}
              errorMessage={tripErrorMessage}
              isSubmitting={isCreatingTrip}
              latestRouteTemplate={latestRouteTemplate}
              onChange={handleTripFormChange}
              onReset={handleResetTripForm}
              onSubmit={handleCreateTrip}
              onUseLatestRoute={handleUseLatestRoute}
              successMessage={tripSuccessMessage}
              values={tripForm}
              vehicles={activeVehicles}
            />
            <div className="button-row">
              <Button onClick={() => router.push('/viajes')} type="button" variant="secondary">
                Volver a operacion
              </Button>
            </div>
          </section>
        </div>
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
    <div className="journey-preview-metric">
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

