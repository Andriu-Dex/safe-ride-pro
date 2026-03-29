'use client';

import { DriverLicenseStatus, DriverVerificationStatus, LuggagePolicy, VehicleType } from '@saferidepro/shared-types';
import { useEffect, useState } from 'react';

import { ApiError } from '../../../lib/api-client';
import { InfoCard } from '../../../components/ui/info-card';
import { StatusPill } from '../../../components/ui/status-pill';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import {
  getDriverLicenseAlertMessage,
  getDriverStatusLabel,
  getDriverStatusTone,
} from '../../../modules/driver/lib/driver-status';
import { VehicleRegistrationForm } from '../../../modules/vehicles/components/vehicle-registration-form';
import {
  canRegisterVehicles,
  getLuggagePolicyLabel,
  getVehicleTypeLabel,
} from '../../../modules/vehicles/lib/vehicle-labels';
import {
  getVehicleOverview,
  listVehicleBrands,
  listVehicleModels,
  registerVehicle,
} from '../../../modules/vehicles/lib/vehicle-api';
import type {
  VehicleBrandCatalogItem,
  VehicleModelCatalogItem,
  VehicleOverview,
} from '../../../modules/vehicles/types/vehicle';

const EMPTY_FORM = {
  vehicleType: VehicleType.Car,
  brandId: '',
  customBrandName: '',
  modelId: '',
  customModelName: '',
  year: `${new Date().getFullYear()}`,
  color: '',
  plate: '',
  seatCount: '4',
  luggagePolicy: LuggagePolicy.SmallOnly,
  registrationDocumentFileKey: '',
};

export default function VehiclesPage() {
  const { authSession, isHydrated } = useAuth();
  const [vehicleOverview, setVehicleOverview] = useState<VehicleOverview | null>(null);
  const [brands, setBrands] = useState<VehicleBrandCatalogItem[]>([]);
  const [models, setModels] = useState<VehicleModelCatalogItem[]>([]);
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [isManualBrand, setIsManualBrand] = useState(false);
  const [isManualModel, setIsManualModel] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated || !authSession) {
      return;
    }

    let isMounted = true;

    const loadVehiclesData = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [overview, brandCatalog] = await Promise.all([
          getVehicleOverview(authSession.accessToken),
          listVehicleBrands(authSession.accessToken),
        ]);

        if (!isMounted) {
          return;
        }

        setVehicleOverview(overview);
        setBrands(brandCatalog);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('No fue posible cargar los vehiculos del usuario.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadVehiclesData();

    return () => {
      isMounted = false;
    };
  }, [authSession, isHydrated]);

  useEffect(() => {
    if (!authSession || isManualBrand || !formValues.brandId) {
      setModels([]);
      return;
    }

    let isMounted = true;

    const loadModels = async () => {
      try {
        const vehicleModels = await listVehicleModels(authSession.accessToken, {
          brandId: formValues.brandId,
          vehicleType: formValues.vehicleType,
        });

        if (!isMounted) {
          return;
        }

        setModels(vehicleModels);
      } catch {
        if (isMounted) {
          setModels([]);
        }
      }
    };

    void loadModels();

    return () => {
      isMounted = false;
    };
  }, [authSession, formValues.brandId, formValues.vehicleType, isManualBrand]);

  const handleFormChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
      ...(field === 'vehicleType' ? { modelId: '', customModelName: '' } : {}),
      ...(field === 'brandId' ? { modelId: '' } : {}),
    }));
  };

  const toggleManualBrand = () => {
    setIsManualBrand((currentValue) => !currentValue);
    setFormValues((currentValues) => ({
      ...currentValues,
      brandId: '',
      customBrandName: '',
      modelId: '',
      customModelName: '',
    }));
    setIsManualModel(false);
    setModels([]);
  };

  const toggleManualModel = () => {
    setIsManualModel((currentValue) => !currentValue);
    setFormValues((currentValues) => ({
      ...currentValues,
      modelId: '',
      customModelName: '',
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authSession) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await registerVehicle(authSession.accessToken, {
        vehicleType: formValues.vehicleType,
        brandId: isManualBrand ? undefined : formValues.brandId || undefined,
        modelId: isManualModel ? undefined : formValues.modelId || undefined,
        customBrandName: isManualBrand ? formValues.customBrandName : undefined,
        customModelName: isManualModel ? formValues.customModelName : undefined,
        year: Number.parseInt(formValues.year, 10),
        color: formValues.color,
        plate: formValues.plate,
        seatCount: Number.parseInt(formValues.seatCount, 10),
        luggagePolicy: formValues.luggagePolicy,
        registrationDocumentFileKey: formValues.registrationDocumentFileKey || undefined,
      });

      const overview = await getVehicleOverview(authSession.accessToken);
      setVehicleOverview(overview);
      setSuccessMessage(response.message);
      setFormValues(EMPTY_FORM);
      setIsManualBrand(false);
      setIsManualModel(false);
      setModels([]);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible registrar el vehiculo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const driverStatus =
    vehicleOverview?.membership?.effectiveDriverVerificationStatus
    ?? vehicleOverview?.membership?.driverVerificationStatus
    ?? DriverVerificationStatus.NotRequested;
  const licenseStatus = vehicleOverview?.membership?.licenseStatus ?? DriverLicenseStatus.Missing;
  const registrationEnabled = canRegisterVehicles(driverStatus, licenseStatus);
  const licenseAlertMessage = getDriverLicenseAlertMessage(
    licenseStatus,
    vehicleOverview?.membership?.licenseExpiresInDays,
  );

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Vehiculos</h1>
          <p className="topbar-subtitle">
            Registra y visualiza los vehiculos asociados a tu perfil de conductor institucional.
          </p>
        </div>
        <StatusPill label={getDriverStatusLabel(driverStatus)} tone={getDriverStatusTone(driverStatus)} />
      </header>

      {isLoading ? (
        <section className="loading-state compact-loading-state">
          <div className="loading-card">
            <div aria-hidden="true" className="loading-pulse" />
            <h2 className="panel-title">Cargando vehiculos</h2>
            <p className="panel-text">Estamos consultando tu membresia y tus registros actuales.</p>
          </div>
        </section>
      ) : (
        <section className="content-grid">
          <div className="metrics-grid">
            <InfoCard
              description="El backend ya esta listo para registrar multiples vehiculos por conductor."
              label="Vehiculos registrados"
              value={`${vehicleOverview?.vehicles.length ?? 0}`}
            />
            <InfoCard
              description="Solo usuarios con proceso de conductor iniciado o aprobado pueden registrar vehiculos."
              label="Permiso actual"
              value={registrationEnabled ? 'Disponible' : 'Bloqueado'}
            />
            <InfoCard
              description="Cada registro queda asociado a tu membresia institucional activa."
              label="Institucion"
              value={vehicleOverview?.membership?.institutionName ?? 'No disponible'}
            />
          </div>

          {!registrationEnabled ? (
            <div className="form-helper">
              {licenseStatus === DriverLicenseStatus.Expired
                ? 'Tu licencia vencio. Debes actualizar tu solicitud de conductor antes de registrar nuevos vehiculos.'
                : 'Debes iniciar o aprobar tu proceso de conductor antes de registrar vehiculos.'}
            </div>
          ) : null}

          {licenseAlertMessage ? (
            <div className="form-helper">
              {licenseAlertMessage}
            </div>
          ) : null}

          <div className="page-grid page-grid-wide">
            <VehicleRegistrationForm
              brands={brands}
              errorMessage={errorMessage}
              isDisabled={!registrationEnabled}
              isManualBrand={isManualBrand}
              isManualModel={isManualModel}
              isSubmitting={isSubmitting}
              models={models}
              onChange={handleFormChange}
              onSubmit={handleSubmit}
              onToggleManualBrand={toggleManualBrand}
              onToggleManualModel={toggleManualModel}
              successMessage={successMessage}
              values={formValues}
            />

            <article className="panel panel-stack">
              <h2 className="panel-title">Mis vehiculos</h2>
              {vehicleOverview?.vehicles.length ? (
                <div className="list-stack">
                  {vehicleOverview.vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="list-card">
                      <div className="list-card-header">
                        <strong>
                          {vehicle.customBrandName ?? vehicle.brandName ?? 'Marca'}{' '}
                          {vehicle.customModelName ?? vehicle.modelName ?? 'Modelo'}
                        </strong>
                        <StatusPill
                          label={vehicle.isActive ? 'Activo' : 'Inactivo'}
                          tone={vehicle.isActive ? 'success' : 'warning'}
                        />
                      </div>
                      <p className="panel-text">
                        {getVehicleTypeLabel(vehicle.vehicleType)} | {vehicle.year} | {vehicle.color} | {vehicle.plate}
                      </p>
                      <p className="panel-text">
                        Capacidad: {vehicle.seatCount} | Equipaje: {getLuggagePolicyLabel(vehicle.luggagePolicy)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="panel-text">
                  Aun no has registrado vehiculos. Usa el formulario para crear el primero.
                </p>
              )}
            </article>
          </div>
        </section>
      )}
    </>
  );
}
