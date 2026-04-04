'use client';

import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  LuggagePolicy,
  VehicleType,
} from '@saferidepro/shared-types';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { FilePreviewModal } from '../../../components/ui/file-preview-modal';
import { InfoCard } from '../../../components/ui/info-card';
import { OperationalAccessCard } from '../../../components/ui/operational-access-card';
import { StatusPill } from '../../../components/ui/status-pill';
import { downloadBlobFile, getFileExtensionFromMimeType } from '../../../lib/blob-file';
import { ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../modules/auth/lib/operational-context';
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
  downloadVehicleRegistrationDocument,
  getVehicleOverview,
  listVehicleBrands,
  listVehicleModels,
  registerVehicle,
  setVehicleActiveStatus,
  updateVehicle,
  uploadVehicleRegistrationDocument,
} from '../../../modules/vehicles/lib/vehicle-api';
import type {
  VehicleBrandCatalogItem,
  VehicleModelCatalogItem,
  VehicleOverview,
  VehicleRecord,
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

type DocumentPreviewState = {
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  preserveUrl: boolean;
  vehicleId?: string | null;
};

function getVehicleDisplayName(vehicle: VehicleRecord): string {
  const brandName = vehicle.customBrandName ?? vehicle.brandName ?? 'Marca';
  const modelName = vehicle.customModelName ?? vehicle.modelName ?? 'Modelo';

  return `${brandName} ${modelName}`.trim();
}

function extractUploadedFileName(fileKey?: string | null): string | null {
  if (!fileKey) {
    return null;
  }

  const segments = fileKey.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? fileKey;
}

function buildVehicleRegistrationDocumentFileName(
  vehicle: Pick<VehicleRecord, 'plate'>,
  mimeType: string,
): string {
  const normalizedPlate = vehicle.plate.replace(/[^A-Z0-9-]+/gi, '').toUpperCase();
  return `matricula-${normalizedPlate}.${getFileExtensionFromMimeType(mimeType)}`;
}

export default function VehiclesPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const [vehicleOverview, setVehicleOverview] = useState<VehicleOverview | null>(null);
  const [brands, setBrands] = useState<VehicleBrandCatalogItem[]>([]);
  const [models, setModels] = useState<VehicleModelCatalogItem[]>([]);
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [isManualBrand, setIsManualBrand] = useState(false);
  const [isManualModel, setIsManualModel] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTogglingVehicleId, setIsTogglingVehicleId] = useState<string | null>(null);
  const [isUploadingRegistrationDocument, setIsUploadingRegistrationDocument] = useState(false);
  const [isOpeningRegistrationDocumentPreview, setIsOpeningRegistrationDocumentPreview] =
    useState(false);
  const [isDownloadingRegistrationDocument, setIsDownloadingRegistrationDocument] =
    useState(false);
  const [currentFormDocumentFileName, setCurrentFormDocumentFileName] = useState<string | null>(
    null,
  );
  const [currentFormDocumentPreviewUrl, setCurrentFormDocumentPreviewUrl] = useState<
    string | null
  >(null);
  const [currentFormDocumentMimeType, setCurrentFormDocumentMimeType] = useState<string | null>(
    null,
  );
  const [currentFormDocumentBlob, setCurrentFormDocumentBlob] = useState<Blob | null>(null);
  const [previewState, setPreviewState] = useState<DocumentPreviewState | null>(null);
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(null);
  const [previewLoadingVehicleId, setPreviewLoadingVehicleId] = useState<string | null>(null);
  const [downloadingVehicleId, setDownloadingVehicleId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [documentErrorMessage, setDocumentErrorMessage] = useState<string | null>(null);
  const [documentSuccessMessage, setDocumentSuccessMessage] = useState<string | null>(null);

  const editingVehicle = useMemo(
    () =>
      vehicleOverview?.vehicles.find((vehicle) => vehicle.id === editingVehicleId) ?? null,
    [editingVehicleId, vehicleOverview?.vehicles],
  );

  useEffect(() => {
    return () => {
      if (currentFormDocumentPreviewUrl) {
        URL.revokeObjectURL(currentFormDocumentPreviewUrl);
      }

      if (previewState?.fileUrl && !previewState.preserveUrl) {
        URL.revokeObjectURL(previewState.fileUrl);
      }
    };
  }, [currentFormDocumentPreviewUrl, previewState]);

  const loadVehicleOverview = async (accessToken: string) => {
    const overview = await getVehicleOverview(accessToken);
    setVehicleOverview(overview);
  };

  const setCurrentFormDocumentState = (
    blob: Blob | null,
    fileName: string | null,
    mimeType: string | null,
  ) => {
    setCurrentFormDocumentPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return blob ? URL.createObjectURL(blob) : null;
    });
    setCurrentFormDocumentBlob(blob);
    setCurrentFormDocumentFileName(fileName);
    setCurrentFormDocumentMimeType(mimeType);
  };

  const clearCurrentFormDocumentState = () => {
    setCurrentFormDocumentPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return null;
    });
    setCurrentFormDocumentBlob(null);
    setCurrentFormDocumentFileName(null);
    setCurrentFormDocumentMimeType(null);
  };

  const resetPreviewState = () => {
    setPreviewErrorMessage(null);
    setPreviewState((currentPreview) => {
      if (currentPreview?.fileUrl && !currentPreview.preserveUrl) {
        URL.revokeObjectURL(currentPreview.fileUrl);
      }

      return null;
    });
  };

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession || !operationalAccess.hasOperationalMembership) {
      setVehicleOverview(null);
      setBrands([]);
      setModels([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await loadVehicleOverview(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : 'No fue posible cargar los vehiculos del usuario.',
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [authSession, isHydrated, operationalAccess.hasOperationalMembership, refreshSession]);

  useEffect(() => {
    if (!authSession || !operationalAccess.hasOperationalMembership) {
      setBrands([]);
      return;
    }

    let isMounted = true;

    const loadBrands = async () => {
      try {
        const brandCatalog = await listVehicleBrands(
          authSession.accessToken,
          formValues.vehicleType,
        );

        if (!isMounted) {
          return;
        }

        setBrands(brandCatalog);
        setFormValues((currentValues) => {
          if (!currentValues.brandId) {
            return currentValues;
          }

          const isBrandAvailable = brandCatalog.some(
            (brand) => brand.id === currentValues.brandId,
          );

          if (isBrandAvailable) {
            return currentValues;
          }

          return {
            ...currentValues,
            brandId: '',
            modelId: '',
          };
        });
      } catch {
        if (isMounted) {
          setBrands([]);
        }
      }
    };

    void loadBrands();

    return () => {
      isMounted = false;
    };
  }, [authSession, formValues.vehicleType, operationalAccess.hasOperationalMembership]);

  useEffect(() => {
    if (
      !authSession ||
      !operationalAccess.hasOperationalMembership ||
      isManualBrand ||
      !formValues.brandId
    ) {
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

        if (isMounted) {
          setModels(vehicleModels);
        }
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
  }, [
    authSession,
    formValues.brandId,
    formValues.vehicleType,
    isManualBrand,
    operationalAccess.hasOperationalMembership,
  ]);

  const handleFormChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
      ...(field === 'vehicleType'
        ? {
            brandId: '',
            customBrandName: '',
            modelId: '',
            customModelName: '',
          }
        : {}),
      ...(field === 'brandId' ? { modelId: '' } : {}),
    }));
  };

  const resetFormState = () => {
    setFormValues(EMPTY_FORM);
    setIsManualBrand(false);
    setIsManualModel(false);
    setEditingVehicleId(null);
    setModels([]);
    clearCurrentFormDocumentState();
  };

  const startEditingVehicle = async (vehicle: VehicleRecord) => {
    setEditingVehicleId(vehicle.id);
    setIsManualBrand(!vehicle.brandId);
    setIsManualModel(!vehicle.modelId);
    setSuccessMessage(null);
    setErrorMessage(null);
    setDocumentErrorMessage(null);
    setDocumentSuccessMessage(null);
    setFormValues({
      vehicleType: vehicle.vehicleType,
      brandId: vehicle.brandId ?? '',
      customBrandName: vehicle.customBrandName ?? '',
      modelId: vehicle.modelId ?? '',
      customModelName: vehicle.customModelName ?? '',
      year: `${vehicle.year}`,
      color: vehicle.color,
      plate: vehicle.plate,
      seatCount: `${vehicle.seatCount}`,
      luggagePolicy: vehicle.luggagePolicy,
      registrationDocumentFileKey: vehicle.registrationDocumentFileKey ?? '',
    });
    setCurrentFormDocumentFileName(
      extractUploadedFileName(vehicle.registrationDocumentFileKey),
    );
    setCurrentFormDocumentBlob(null);
    setCurrentFormDocumentMimeType(null);
    setCurrentFormDocumentPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return null;
    });

    if (vehicle.brandId && authSession) {
      try {
        const vehicleModels = await listVehicleModels(authSession.accessToken, {
          brandId: vehicle.brandId,
          vehicleType: vehicle.vehicleType,
        });
        setModels(vehicleModels);
      } catch {
        setModels([]);
      }
    } else {
      setModels([]);
    }
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

  const handleUploadValidationError = (message: string) => {
    setDocumentSuccessMessage(null);
    setDocumentErrorMessage(message);
  };

  const handleUploadRegistrationDocument = async (file: File) => {
    if (!authSession) {
      return;
    }

    setIsUploadingRegistrationDocument(true);
    setDocumentErrorMessage(null);
    setDocumentSuccessMessage(null);

    try {
      const response = await uploadVehicleRegistrationDocument(authSession.accessToken, file);

      setFormValues((currentValues) => ({
        ...currentValues,
        registrationDocumentFileKey: response.fileKey,
      }));
      setCurrentFormDocumentState(file, file.name, file.type);
      setDocumentSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setDocumentErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'No fue posible cargar el documento del vehiculo.',
      );
    } finally {
      setIsUploadingRegistrationDocument(false);
    }
  };

  const fetchVehicleDocumentBlob = async (vehicle: VehicleRecord) => {
    if (!authSession) {
      throw new ApiError('No fue posible autenticar la descarga del documento.', 401);
    }

    const blob = await downloadVehicleRegistrationDocument(authSession.accessToken, vehicle.id);

    return {
      blob,
      fileName: buildVehicleRegistrationDocumentFileName(vehicle, blob.type),
    };
  };

  const handlePreviewRegistrationDocument = async () => {
    if (!formValues.registrationDocumentFileKey.trim()) {
      setDocumentErrorMessage(
        'Primero carga o conserva un documento de matricula para previsualizarlo.',
      );
      return;
    }

    setPreviewErrorMessage(null);

    if (currentFormDocumentPreviewUrl && currentFormDocumentFileName && currentFormDocumentMimeType) {
      setPreviewState({
        title: 'Documento de matricula',
        fileName: currentFormDocumentFileName,
        fileUrl: currentFormDocumentPreviewUrl,
        mimeType: currentFormDocumentMimeType,
        preserveUrl: true,
        vehicleId: editingVehicleId,
      });
      return;
    }

    if (!editingVehicle) {
      setDocumentErrorMessage(
        'Todavia no hay una previsualizacion local disponible. Guarda el vehiculo o vuelve a cargar el archivo.',
      );
      return;
    }

    setIsOpeningRegistrationDocumentPreview(true);

    try {
      const { blob, fileName } = await fetchVehicleDocumentBlob(editingVehicle);
      const objectUrl = URL.createObjectURL(blob);

      setPreviewState((currentPreview) => {
        if (currentPreview?.fileUrl && !currentPreview.preserveUrl) {
          URL.revokeObjectURL(currentPreview.fileUrl);
        }

        return {
          title: 'Documento de matricula',
          fileName,
          fileUrl: objectUrl,
          mimeType: blob.type,
          preserveUrl: false,
          vehicleId: editingVehicle.id,
        };
      });
    } catch (error) {
      setPreviewErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'No fue posible abrir la previsualizacion del documento del vehiculo.',
      );
    } finally {
      setIsOpeningRegistrationDocumentPreview(false);
    }
  };

  const handleDownloadRegistrationDocument = async () => {
    if (!formValues.registrationDocumentFileKey.trim()) {
      setDocumentErrorMessage('No hay un documento de matricula disponible para descargar.');
      return;
    }

    if (currentFormDocumentBlob && currentFormDocumentFileName) {
      downloadBlobFile(currentFormDocumentBlob, currentFormDocumentFileName);
      return;
    }

    if (!editingVehicle) {
      setDocumentErrorMessage(
        'Guarda el vehiculo antes de descargar el documento o vuelve a cargar el archivo.',
      );
      return;
    }

    setIsDownloadingRegistrationDocument(true);
    setDocumentErrorMessage(null);

    try {
      const { blob, fileName } = await fetchVehicleDocumentBlob(editingVehicle);
      downloadBlobFile(blob, fileName);
    } catch (error) {
      setDocumentErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'No fue posible descargar el documento del vehiculo.',
      );
    } finally {
      setIsDownloadingRegistrationDocument(false);
    }
  };

  const handlePreviewStoredVehicleDocument = async (vehicle: VehicleRecord) => {
    setPreviewLoadingVehicleId(vehicle.id);
    setPreviewErrorMessage(null);

    try {
      const { blob, fileName } = await fetchVehicleDocumentBlob(vehicle);
      const objectUrl = URL.createObjectURL(blob);

      setPreviewState((currentPreview) => {
        if (currentPreview?.fileUrl && !currentPreview.preserveUrl) {
          URL.revokeObjectURL(currentPreview.fileUrl);
        }

        return {
          title: `Documento de matricula - ${getVehicleDisplayName(vehicle)}`,
          fileName,
          fileUrl: objectUrl,
          mimeType: blob.type,
          preserveUrl: false,
          vehicleId: vehicle.id,
        };
      });
    } catch (error) {
      setPreviewErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'No fue posible abrir la previsualizacion del documento del vehiculo.',
      );
    } finally {
      setPreviewLoadingVehicleId(null);
    }
  };

  const handleDownloadStoredVehicleDocument = async (vehicle: VehicleRecord) => {
    setDownloadingVehicleId(vehicle.id);
    setDocumentErrorMessage(null);

    try {
      const { blob, fileName } = await fetchVehicleDocumentBlob(vehicle);
      downloadBlobFile(blob, fileName);
    } catch (error) {
      setDocumentErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'No fue posible descargar el documento del vehiculo.',
      );
    } finally {
      setDownloadingVehicleId(null);
    }
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
      const payload = {
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
      };

      const response = editingVehicleId
        ? await updateVehicle(authSession.accessToken, editingVehicleId, payload)
        : await registerVehicle(authSession.accessToken, payload);

      await loadVehicleOverview(authSession.accessToken);
      setSuccessMessage(response.message);
      setDocumentSuccessMessage(null);
      resetFormState();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : editingVehicleId
            ? 'No fue posible actualizar el vehiculo.'
            : 'No fue posible registrar el vehiculo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleVehicleStatus = async (vehicle: VehicleRecord) => {
    if (!authSession) {
      return;
    }

    setIsTogglingVehicleId(vehicle.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await setVehicleActiveStatus(
        authSession.accessToken,
        vehicle.id,
        !vehicle.isActive,
      );

      await loadVehicleOverview(authSession.accessToken);
      setSuccessMessage(response.message);

      if (editingVehicleId === vehicle.id && vehicle.isActive) {
        resetFormState();
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'No fue posible actualizar el estado del vehiculo.',
      );
    } finally {
      setIsTogglingVehicleId(null);
    }
  };

  const driverStatus =
    vehicleOverview?.membership?.effectiveDriverVerificationStatus ??
    vehicleOverview?.membership?.driverVerificationStatus ??
    DriverVerificationStatus.NotRequested;
  const licenseStatus =
    vehicleOverview?.membership?.licenseStatus ?? DriverLicenseStatus.Missing;
  const vehicleManagementEnabled = canRegisterVehicles(driverStatus, licenseStatus);
  const activeVehicles =
    vehicleOverview?.vehicles.filter((vehicle) => vehicle.isActive).length ?? 0;
  const vehiclesWithOperationalTrips =
    vehicleOverview?.vehicles.filter((vehicle) => vehicle.operationalTripCount > 0).length ?? 0;
  const licenseAlertMessage = getDriverLicenseAlertMessage(
    licenseStatus,
    vehicleOverview?.membership?.licenseExpiresInDays,
  );

  if (
    !isLoading &&
    !operationalAccess.hasOperationalMembership &&
    operationalAccess.title &&
    operationalAccess.message
  ) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="topbar-title">Vehiculos</h1>
            <p className="topbar-subtitle">
              Registra y gestiona los vehiculos asociados a tu perfil de conductor.
            </p>
          </div>
          <StatusPill label="Operacion bloqueada" tone="warning" />
        </header>

        <section className="empty-state">
          <OperationalAccessCard
            message={operationalAccess.message}
            title={operationalAccess.title}
          />
        </section>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Vehiculos</h1>
          <p className="topbar-subtitle">
            Registra, edita y activa tus vehiculos antes de utilizarlos en viajes.
          </p>
        </div>
        <StatusPill
          label={getDriverStatusLabel(driverStatus)}
          tone={getDriverStatusTone(driverStatus)}
        />
      </header>

      {isLoading ? (
        <section className="loading-state compact-loading-state">
          <div className="loading-card">
            <div aria-hidden="true" className="loading-pulse" />
            <h2 className="panel-title">Cargando vehiculos</h2>
            <p className="panel-text">
              Estamos consultando tu membresia de conductor y los vehiculos ya registrados.
            </p>
          </div>
        </section>
      ) : (
        <section className="content-grid">
          <div className="metrics-grid">
            <InfoCard
              description="Vehiculos totales asociados a tu membresia institucional activa."
              label="Registrados"
              value={`${vehicleOverview?.vehicles.length ?? 0}`}
            />
            <InfoCard
              description="Vehiculos listos para ser seleccionados al crear nuevos viajes."
              label="Activos"
              value={`${activeVehicles}`}
            />
            <InfoCard
              description="Vehiculos que actualmente tienen viajes publicados, llenos o en curso."
              label="Con viajes operativos"
              value={`${vehiclesWithOperationalTrips}`}
            />
          </div>

          {!vehicleManagementEnabled ? (
            <div className="form-helper">
              {licenseStatus === DriverLicenseStatus.Expired
                ? 'Tu licencia vencio. Debes actualizar tu solicitud de conductor antes de registrar o editar vehiculos.'
                : 'Debes iniciar o aprobar tu proceso de conductor antes de gestionar vehiculos.'}
            </div>
          ) : null}

          {licenseAlertMessage ? <div className="form-helper">{licenseAlertMessage}</div> : null}

          <div className="page-grid page-grid-wide">
            <VehicleRegistrationForm
              brands={brands}
              documentErrorMessage={documentErrorMessage}
              documentSuccessMessage={documentSuccessMessage}
              editingVehicleName={editingVehicle ? getVehicleDisplayName(editingVehicle) : null}
              errorMessage={errorMessage}
              isDisabled={!vehicleManagementEnabled}
              isDownloadingRegistrationDocument={isDownloadingRegistrationDocument}
              isEditing={Boolean(editingVehicle)}
              isManualBrand={isManualBrand}
              isManualModel={isManualModel}
              isOpeningRegistrationDocumentPreview={isOpeningRegistrationDocumentPreview}
              isSubmitting={isSubmitting}
              isUploadingRegistrationDocument={isUploadingRegistrationDocument}
              models={models}
              onCancelEdit={resetFormState}
              onChange={handleFormChange}
              onDownloadRegistrationDocument={() => void handleDownloadRegistrationDocument()}
              onPreviewRegistrationDocument={() => void handlePreviewRegistrationDocument()}
              onSubmit={handleSubmit}
              onToggleManualBrand={toggleManualBrand}
              onToggleManualModel={toggleManualModel}
              onUploadRegistrationDocument={(file) => void handleUploadRegistrationDocument(file)}
              onUploadValidationError={handleUploadValidationError}
              registrationDocumentFileName={currentFormDocumentFileName}
              registrationDocumentPreviewUrl={currentFormDocumentPreviewUrl}
              successMessage={successMessage}
              values={formValues}
            />

            <article className="panel panel-stack">
              <div className="panel-header-row">
                <div>
                  <h2 className="panel-title">Mis vehiculos</h2>
                  <p className="panel-text">
                    Edita los datos del vehiculo o controla si debe seguir disponible para nuevos viajes.
                  </p>
                </div>
                <StatusPill
                  label={`${vehicleOverview?.vehicles.length ?? 0} registrados`}
                  tone="neutral"
                />
              </div>

              {vehicleOverview?.vehicles.length ? (
                <div className="list-stack">
                  {vehicleOverview.vehicles.map((vehicle) => {
                    const isBusy = isTogglingVehicleId === vehicle.id;
                    const isLockedByTrips = vehicle.operationalTripCount > 0;
                    const isEditingCurrentVehicle = editingVehicleId === vehicle.id;
                    const hasRegistrationDocument = Boolean(vehicle.registrationDocumentFileKey);

                    return (
                      <div key={vehicle.id} className="list-card">
                        <div className="list-card-header">
                          <strong>{getVehicleDisplayName(vehicle)}</strong>
                          <div className="button-row">
                            <StatusPill
                              label={vehicle.isActive ? 'Activo' : 'Inactivo'}
                              tone={vehicle.isActive ? 'success' : 'warning'}
                            />
                            {isLockedByTrips ? (
                              <StatusPill label="Con viajes operativos" tone="warning" />
                            ) : null}
                          </div>
                        </div>

                        <div className="analytics-detail-grid">
                          <div className="analytics-detail-card">
                            <span>Tipo</span>
                            <strong>{getVehicleTypeLabel(vehicle.vehicleType)}</strong>
                            <p>
                              Capacidad {vehicle.seatCount} | Equipaje {getLuggagePolicyLabel(vehicle.luggagePolicy)}
                            </p>
                          </div>
                          <div className="analytics-detail-card">
                            <span>Identificacion</span>
                            <strong>{vehicle.plate}</strong>
                            <p>
                              {vehicle.color} | {vehicle.year}
                            </p>
                          </div>
                          <div className="analytics-detail-card">
                            <span>Documento</span>
                            <strong>{hasRegistrationDocument ? 'Registrado' : 'Pendiente'}</strong>
                            <p>
                              {hasRegistrationDocument
                                ? 'Disponible para previsualizar o descargar.'
                                : 'Aun no se ha cargado el documento de matricula.'}
                            </p>
                          </div>
                        </div>

                        {hasRegistrationDocument ? (
                          <div className="button-row">
                            <Button
                              disabled={previewLoadingVehicleId === vehicle.id}
                              onClick={() => void handlePreviewStoredVehicleDocument(vehicle)}
                              variant="secondary"
                            >
                              {previewLoadingVehicleId === vehicle.id
                                ? 'Abriendo...'
                                : 'Ver documento'}
                            </Button>
                            <Button
                              disabled={downloadingVehicleId === vehicle.id}
                              onClick={() => void handleDownloadStoredVehicleDocument(vehicle)}
                              variant="ghost"
                            >
                              {downloadingVehicleId === vehicle.id
                                ? 'Descargando...'
                                : 'Descargar'}
                            </Button>
                          </div>
                        ) : null}

                        {isLockedByTrips ? (
                          <div className="form-helper">
                            Este vehiculo tiene viajes publicados, llenos o en curso. No puede editarse ni desactivarse hasta cerrar esos trayectos.
                          </div>
                        ) : null}

                        <div className="button-row">
                          <Button
                            disabled={!vehicleManagementEnabled || isLockedByTrips}
                            onClick={() => void startEditingVehicle(vehicle)}
                            variant={isEditingCurrentVehicle ? 'primary' : 'secondary'}
                          >
                            {isEditingCurrentVehicle ? 'Editando' : 'Editar'}
                          </Button>
                          <Button
                            disabled={
                              !vehicleManagementEnabled ||
                              isBusy ||
                              (vehicle.isActive && isLockedByTrips)
                            }
                            onClick={() => void handleToggleVehicleStatus(vehicle)}
                            variant="ghost"
                          >
                            {isBusy
                              ? 'Actualizando...'
                              : vehicle.isActive
                                ? 'Desactivar'
                                : 'Activar'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="panel-text">
                  Aun no has registrado vehiculos. Crea el primero para continuar con la publicacion de viajes.
                </p>
              )}
            </article>
          </div>
        </section>
      )}

      <FilePreviewModal
        description={
          previewState?.mimeType?.startsWith('image/')
            ? 'Pasa el puntero sobre la imagen para ampliar los detalles.'
            : 'Revisa el documento vehicular antes de descargarlo o continuar.'
        }
        errorMessage={previewErrorMessage}
        fileName={previewState?.fileName ?? null}
        fileUrl={previewState?.fileUrl ?? null}
        isDownloading={
          previewState?.vehicleId
            ? downloadingVehicleId === previewState.vehicleId
            : isDownloadingRegistrationDocument
        }
        isLoading={
          isOpeningRegistrationDocumentPreview ||
          (previewState?.vehicleId
            ? previewLoadingVehicleId === previewState.vehicleId
            : false)
        }
        isOpen={Boolean(previewState) || Boolean(previewErrorMessage)}
        mimeType={previewState?.mimeType ?? null}
        onClose={resetPreviewState}
        onDownload={
          previewState?.vehicleId
            ? () => {
                const vehicle = vehicleOverview?.vehicles.find(
                  (item) => item.id === previewState.vehicleId,
                );

                if (vehicle) {
                  void handleDownloadStoredVehicleDocument(vehicle);
                }
              }
            : formValues.registrationDocumentFileKey
              ? () => void handleDownloadRegistrationDocument()
              : undefined
        }
        title={previewState?.title ?? 'Documento de matricula'}
      />
    </>
  );
}
