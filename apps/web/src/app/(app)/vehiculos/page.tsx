'use client';

import Link from 'next/link';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  LuggagePolicy,
  VehicleType,
} from '@saferidepro/shared-types';
import { useEffect, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { FilePreviewModal } from '../../../components/ui/file-preview-modal';
import { InputField } from '../../../components/ui/input-field';
import { OperationalAccessCard } from '../../../components/ui/operational-access-card';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { downloadBlobFile, getFileExtensionFromMimeType } from '../../../lib/blob-file';
import { ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { suppressAuthSessionSync } from '../../../modules/auth/lib/auth-sync-guard';
import { getOperationalAccessState } from '../../../modules/auth/lib/operational-context';
import {
  getDriverLicenseAlertMessage,
  getDriverStatusLabel,
  getDriverStatusTone,
} from '../../../modules/driver/lib/driver-status';
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
import styles from './page.module.css';

const emptyForm = {
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

const allowedVehicleDocumentMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const maxVehicleDocumentSizeBytes = 8 * 1024 * 1024;

type VehicleFormValues = typeof emptyForm;

type PreviewState = {
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
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

function buildVehicleValidationMessage(
  values: VehicleFormValues,
  isManualBrand: boolean,
  isManualModel: boolean,
): string | null {
  const currentYear = new Date().getFullYear();
  const yearValue = Number.parseInt(values.year, 10);
  const seatCountValue = Number.parseInt(values.seatCount, 10);
  const plateValue = values.plate.trim();

  if (isManualBrand ? !values.customBrandName.trim() : !values.brandId) {
    return 'Ingresa una marca valida.';
  }

  if (isManualModel ? !values.customModelName.trim() : !values.modelId) {
    return 'Ingresa un modelo valido.';
  }

  if (Number.isNaN(yearValue) || yearValue < 1990 || yearValue > currentYear + 1) {
    return `El anio debe estar entre 1990 y ${currentYear + 1}.`;
  }

  if (!values.color.trim()) {
    return 'Ingresa el color principal del vehiculo.';
  }

  if (plateValue.length < 6) {
    return 'Ingresa una placa valida.';
  }

  if (Number.isNaN(seatCountValue) || seatCountValue < 1) {
    return 'La capacidad debe ser de al menos 1 cupo.';
  }

  if (values.vehicleType === VehicleType.Motorcycle && seatCountValue !== 1) {
    return 'La motocicleta solo puede registrarse con 1 cupo.';
  }

  if (values.vehicleType === VehicleType.Car && seatCountValue > 4) {
    return 'El auto no puede exceder 4 cupos.';
  }

  if (values.vehicleType === VehicleType.PickupTruck && seatCountValue > 5) {
    return 'La camioneta no puede exceder 5 cupos.';
  }

  if (!values.registrationDocumentFileKey.trim()) {
    return 'Carga el documento de matricula.';
  }

  return null;
}

function buildVehiclePayload(
  values: VehicleFormValues,
  isManualBrand: boolean,
  isManualModel: boolean,
) {
  return {
    vehicleType: values.vehicleType,
    brandId: isManualBrand ? undefined : values.brandId || undefined,
    modelId: isManualModel ? undefined : values.modelId || undefined,
    customBrandName: isManualBrand ? values.customBrandName.trim() : undefined,
    customModelName: isManualModel ? values.customModelName.trim() : undefined,
    year: Number.parseInt(values.year, 10),
    color: values.color.trim(),
    plate: values.plate.trim().toUpperCase(),
    seatCount: Number.parseInt(values.seatCount, 10),
    luggagePolicy: values.luggagePolicy,
    registrationDocumentFileKey: values.registrationDocumentFileKey || undefined,
  };
}

export default function VehiclesPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const [vehicleOverview, setVehicleOverview] = useState<VehicleOverview | null>(null);
  const [brands, setBrands] = useState<VehicleBrandCatalogItem[]>([]);
  const [models, setModels] = useState<VehicleModelCatalogItem[]>([]);
  const [formValues, setFormValues] = useState<VehicleFormValues>(emptyForm);
  const [isManualBrand, setIsManualBrand] = useState(false);
  const [isManualModel, setIsManualModel] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isTogglingVehicleId, setIsTogglingVehicleId] = useState<string | null>(null);
  const [isUploadingRegistrationDocument, setIsUploadingRegistrationDocument] =
    useState(false);
  const [isOpeningRegistrationDocumentPreview, setIsOpeningRegistrationDocumentPreview] =
    useState(false);
  const [isDownloadingRegistrationDocument, setIsDownloadingRegistrationDocument] =
    useState(false);
  const [previewLoadingVehicleId, setPreviewLoadingVehicleId] = useState<string | null>(
    null,
  );
  const [downloadingVehicleId, setDownloadingVehicleId] = useState<string | null>(null);
  const [currentFormDocumentBlob, setCurrentFormDocumentBlob] = useState<Blob | null>(null);
  const [currentFormDocumentFileName, setCurrentFormDocumentFileName] = useState<string | null>(
    null,
  );
  const [currentFormDocumentMimeType, setCurrentFormDocumentMimeType] = useState<string | null>(
    null,
  );
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = (
    title: string,
    description: string,
    tone: ToastItem['tone'] = 'info',
  ) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `vehicle-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) =>
      currentToasts.filter((toast) => toast.id !== toastId),
    );
  };

  const syncFormFromVehicle = (vehicle: VehicleRecord | null) => {
    if (!vehicle) {
      setFormValues(emptyForm);
      setIsManualBrand(false);
      setIsManualModel(false);
      setCurrentFormDocumentBlob(null);
      setCurrentFormDocumentFileName(null);
      setCurrentFormDocumentMimeType(null);
      return;
    }

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
    setIsManualBrand(!vehicle.brandId);
    setIsManualModel(!vehicle.modelId);
    setCurrentFormDocumentBlob(null);
    setCurrentFormDocumentFileName(
      extractUploadedFileName(vehicle.registrationDocumentFileKey),
    );
    setCurrentFormDocumentMimeType(null);
  };

  const loadVehicleData = async (accessToken: string) => {
    const overview = await getVehicleOverview(accessToken);
    setVehicleOverview(overview);
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

      try {
        await loadVehicleData(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        pushToast(
          'No se pudo cargar',
          error instanceof ApiError
            ? error.message
            : 'No fue posible cargar tus vehiculos.',
          'error',
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
        const catalog = await listVehicleBrands(authSession.accessToken, formValues.vehicleType);

        if (!isMounted) {
          return;
        }

        setBrands(catalog);
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
        const catalog = await listVehicleModels(authSession.accessToken, {
          brandId: formValues.brandId,
          vehicleType: formValues.vehicleType,
        });

        if (isMounted) {
          setModels(catalog);
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

  useEffect(() => {
    return () => {
      if (previewState?.fileUrl) {
        URL.revokeObjectURL(previewState.fileUrl);
      }
    };
  }, [previewState]);

  const currentStatus =
    vehicleOverview?.membership?.effectiveDriverVerificationStatus ??
    vehicleOverview?.membership?.driverVerificationStatus ??
    DriverVerificationStatus.NotRequested;
  const licenseStatus =
    vehicleOverview?.membership?.licenseStatus ?? DriverLicenseStatus.Missing;
  const licenseAlertMessage = getDriverLicenseAlertMessage(
    licenseStatus,
    vehicleOverview?.membership?.licenseExpiresInDays,
  );
  const vehicleManagementEnabled = canRegisterVehicles(currentStatus, licenseStatus);
  const editingVehicle =
    vehicleOverview?.vehicles.find((vehicle) => vehicle.id === editingVehicleId) ?? null;
  const validationMessage = buildVehicleValidationMessage(
    formValues,
    isManualBrand,
    isManualModel,
  );
  const totalVehicles = vehicleOverview?.vehicles.length ?? 0;
  const vehiclesWithTrips =
    vehicleOverview?.vehicles.filter((vehicle) => vehicle.operationalTripCount > 0).length ?? 0;

  const openRegistrationModal = () => {
    if (!vehicleManagementEnabled) {
      pushToast(
        'Operacion restringida',
        licenseStatus === DriverLicenseStatus.Expired
          ? 'Tu licencia esta vencida. Actualizala antes de gestionar vehiculos.'
          : 'Necesitas habilitacion de conductor para gestionar vehiculos.',
        'info',
      );
      return;
    }

    setEditingVehicleId(null);
    syncFormFromVehicle(null);
    setIsRegistrationModalOpen(true);
  };

  const openEditVehicleModal = (vehicle: VehicleRecord) => {
    if (!vehicleManagementEnabled) {
      pushToast(
        'Operacion restringida',
        'Tu cuenta no puede editar vehiculos en este momento.',
        'info',
      );
      return;
    }

    setEditingVehicleId(vehicle.id);
    syncFormFromVehicle(vehicle);
    setIsRegistrationModalOpen(true);
  };

  const closeRegistrationModal = () => {
    setIsRegistrationModalOpen(false);
    setEditingVehicleId(null);
    syncFormFromVehicle(null);
  };

  const handleFormChange = (field: keyof VehicleFormValues, value: string) => {
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

  const toggleManualBrand = () => {
    setIsManualBrand((currentValue) => !currentValue);
    setIsManualModel(false);
    setModels([]);
    setFormValues((currentValues) => ({
      ...currentValues,
      brandId: '',
      customBrandName: '',
      modelId: '',
      customModelName: '',
    }));
  };

  const toggleManualModel = () => {
    setIsManualModel((currentValue) => !currentValue);
    setFormValues((currentValues) => ({
      ...currentValues,
      modelId: '',
      customModelName: '',
    }));
  };

  const fetchVehicleDocumentBlob = async (vehicle: VehicleRecord) => {
    if (!authSession) {
      throw new ApiError('No fue posible autenticar la descarga.', 401);
    }

    const blob = await downloadVehicleRegistrationDocument(authSession.accessToken, vehicle.id);

    return {
      blob,
      fileName: buildVehicleRegistrationDocumentFileName(vehicle, blob.type),
    };
  };

  const handleUploadValidationError = (message: string) => {
    pushToast('Archivo no valido', message, 'info');
  };

  const handleUploadRegistrationDocument = async (file: File) => {
    if (!authSession) {
      return;
    }

    setIsUploadingRegistrationDocument(true);

    try {
      const response = await uploadVehicleRegistrationDocument(authSession.accessToken, file);

      setFormValues((currentValues) => ({
        ...currentValues,
        registrationDocumentFileKey: response.fileKey,
      }));
      setCurrentFormDocumentBlob(file);
      setCurrentFormDocumentFileName(file.name);
      setCurrentFormDocumentMimeType(file.type);
      pushToast('Documento cargado', response.message, 'success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo cargar',
        error instanceof ApiError
          ? error.message
          : 'No fue posible cargar la matricula.',
        'error',
      );
    } finally {
      setIsUploadingRegistrationDocument(false);
    }
  };

  const handlePreviewRegistrationDocument = async () => {
    if (!formValues.registrationDocumentFileKey.trim()) {
      pushToast('Falta documento', 'Carga una matricula antes de previsualizar.', 'info');
      return;
    }

    if (currentFormDocumentBlob && currentFormDocumentFileName && currentFormDocumentMimeType) {
      setPreviewState({
        title: 'Documento de matricula',
        fileName: currentFormDocumentFileName,
        fileUrl: URL.createObjectURL(currentFormDocumentBlob),
        mimeType: currentFormDocumentMimeType,
        vehicleId: editingVehicleId,
      });
      return;
    }

    if (!editingVehicle) {
      pushToast(
        'Sin vista previa',
        'Guarda el vehiculo o vuelve a cargar el archivo para abrirlo.',
        'info',
      );
      return;
    }

    setIsOpeningRegistrationDocumentPreview(true);

    try {
      const { blob, fileName } = await fetchVehicleDocumentBlob(editingVehicle);
      setPreviewState({
        title: 'Documento de matricula',
        fileName,
        fileUrl: URL.createObjectURL(blob),
        mimeType: blob.type,
        vehicleId: editingVehicle.id,
      });
    } catch (error) {
      pushToast(
        'No se pudo abrir',
        error instanceof ApiError
          ? error.message
          : 'No fue posible abrir el documento.',
        'error',
      );
    } finally {
      setIsOpeningRegistrationDocumentPreview(false);
    }
  };

  const handleDownloadRegistrationDocument = async () => {
    if (currentFormDocumentBlob && currentFormDocumentFileName) {
      downloadBlobFile(currentFormDocumentBlob, currentFormDocumentFileName);
      return;
    }

    if (!editingVehicle) {
      pushToast('Sin documento', 'No hay un documento disponible para descargar.', 'info');
      return;
    }

    setIsDownloadingRegistrationDocument(true);

    try {
      const { blob, fileName } = await fetchVehicleDocumentBlob(editingVehicle);
      downloadBlobFile(blob, fileName);
    } catch (error) {
      pushToast(
        'No se pudo descargar',
        error instanceof ApiError
          ? error.message
          : 'No fue posible descargar el documento.',
        'error',
      );
    } finally {
      setIsDownloadingRegistrationDocument(false);
    }
  };

  const handlePreviewStoredVehicleDocument = async (vehicle: VehicleRecord) => {
    setPreviewLoadingVehicleId(vehicle.id);

    try {
      const { blob, fileName } = await fetchVehicleDocumentBlob(vehicle);
      setPreviewState((currentPreview) => {
        if (currentPreview?.fileUrl) {
          URL.revokeObjectURL(currentPreview.fileUrl);
        }

        return {
          title: 'Documento de matricula',
          fileName,
          fileUrl: URL.createObjectURL(blob),
          mimeType: blob.type,
          vehicleId: vehicle.id,
        };
      });
    } catch (error) {
      pushToast(
        'No se pudo abrir',
        error instanceof ApiError
          ? error.message
          : 'No fue posible abrir el documento.',
        'error',
      );
    } finally {
      setPreviewLoadingVehicleId(null);
    }
  };

  const handleDownloadStoredVehicleDocument = async (vehicle: VehicleRecord) => {
    setDownloadingVehicleId(vehicle.id);

    try {
      const { blob, fileName } = await fetchVehicleDocumentBlob(vehicle);
      downloadBlobFile(blob, fileName);
    } catch (error) {
      pushToast(
        'No se pudo descargar',
        error instanceof ApiError
          ? error.message
          : 'No fue posible descargar el documento.',
        'error',
      );
    } finally {
      setDownloadingVehicleId(null);
    }
  };

  const handleToggleVehicleStatus = async (vehicle: VehicleRecord) => {
    if (!authSession) {
      return;
    }

    if (vehicle.isActive && vehicle.operationalTripCount > 0) {
      pushToast(
        'No disponible',
        'No puedes desactivar un vehiculo con viajes operativos.',
        'info',
      );
      return;
    }

    setIsTogglingVehicleId(vehicle.id);

    try {
      const response = await setVehicleActiveStatus(
        authSession.accessToken,
        vehicle.id,
        !vehicle.isActive,
      );

      await loadVehicleData(authSession.accessToken);
      pushToast('Estado actualizado', response.message, 'success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo actualizar',
        error instanceof ApiError
          ? error.message
          : 'No fue posible actualizar el estado del vehiculo.',
        'error',
      );
    } finally {
      setIsTogglingVehicleId(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authSession) {
      return;
    }

    if (validationMessage) {
      pushToast('Revisa el formulario', validationMessage, 'info');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = buildVehiclePayload(formValues, isManualBrand, isManualModel);

      if (editingVehicleId) {
        const response = await updateVehicle(
          authSession.accessToken,
          editingVehicleId,
          payload,
        );
        pushToast('Vehiculo actualizado', response.message, 'success');
      } else {
        const response = await registerVehicle(authSession.accessToken, payload);
        pushToast('Vehiculo registrado', response.message, 'success');
      }

      await loadVehicleData(authSession.accessToken);
      closeRegistrationModal();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo guardar',
        error instanceof ApiError
          ? error.message
          : 'No fue posible guardar el vehiculo.',
        'error',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPreviewState = () => {
    setPreviewState((currentPreview) => {
      if (currentPreview?.fileUrl) {
        URL.revokeObjectURL(currentPreview.fileUrl);
      }

      return null;
    });
  };

  const getBadgeClass = (tone: string) => {
    switch (tone) {
      case 'success': return styles.heroBadgeSuccess;
      case 'warning': return styles.heroBadgeWarning;
      case 'danger': return styles.heroBadgeDanger;
      default: return styles.heroBadgeNeutral;
    }
  };

  if (
    !isLoading &&
    !operationalAccess.hasOperationalMembership &&
    operationalAccess.title &&
    operationalAccess.message
  ) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.pageBackground}>
          <article className={`${styles.canvas} ${styles.canvasSmall}`}>
            <div className={styles.lockedHeader}>
              <div>
                <p className={styles.kicker}>Vehiculos</p>
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
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      {isLoading ? (
        <section className={styles.pageBackground}>
          <article className={`${styles.canvas} ${styles.canvasSmall}`}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h2 className={styles.loadingTitle}>Cargando vehiculos</h2>
            <p className={styles.loadingText}>Estamos consultando tu flota actual.</p>
          </article>
        </section>
      ) : (
        <section className={styles.pageBackground}>
          <div className={`${styles.canvas} ${styles.revealSoft}`}>
          <section className={styles.hero}>
            <div className={styles.heroTop}>
              <div className={styles.heroCopy}>
                <p className={styles.kicker}>Vehiculos</p>
                <h1 className={styles.heroTitle}>Gestiona tus vehiculos</h1>
                <p className={styles.heroLead}>
                  Registra tus unidades y activalas para que queden listas para publicar viajes.
                </p>
              </div>

              <div className={styles.heroPills}>
                <span className={`${styles.heroBadge} ${getBadgeClass(getDriverStatusTone(currentStatus))}`}>
                  {getDriverStatusLabel(currentStatus)}
                </span>
                <span className={`${styles.heroBadge} ${getBadgeClass(vehicleManagementEnabled ? 'success' : 'warning')}`}>
                  {vehicleManagementEnabled ? 'Gestion habilitada' : 'Gestion limitada'}
                </span>
              </div>
            </div>

            <div className={styles.heroActions}>
              <button className={styles.heroBtnPrimary} onClick={openRegistrationModal} type="button">
                Registrar vehiculo
              </button>
              <Link className={styles.heroBtnSecondary} href="/conductor">
                Ver conductor
              </Link>
              <Link className={styles.heroBtnGhost} href="/viajes">
                Ir a viajes
              </Link>
            </div>
          </section>

          <section className={styles.mainGrid}>
            <div className={styles.contentColumn}>
              <article className={`${styles.fleetCard} ${styles.reveal}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.kicker}>Listado</p>
                    <h2>Vehiculos registrados</h2>
                  </div>
                  <StatusPill label={`${totalVehicles} total`} tone="neutral" />
                </div>

                {vehicleOverview?.vehicles.length ? (
                  <div className={styles.vehicleList}>
                    {vehicleOverview.vehicles.map((vehicle) => {
                      const isBusy = isTogglingVehicleId === vehicle.id;
                      const hasRegistrationDocument = Boolean(
                        vehicle.registrationDocumentFileKey,
                      );
                      const isLockedByTrips = vehicle.operationalTripCount > 0;

                      return (
                        <article className={styles.vehicleCard} key={vehicle.id}>
                          <div className={styles.vehicleCardHeader}>
                            <div className={styles.vehicleTitleGroup}>
                              <h3 className={styles.vehicleName}>
                                {getVehicleDisplayName(vehicle)}
                              </h3>

                            <div className={styles.vehiclePills}>
                              <StatusPill
                                label={vehicle.isActive ? 'Activo' : 'Inactivo'}
                                tone={vehicle.isActive ? 'success' : 'warning'}
                              />
                              {isLockedByTrips ? (
                                <StatusPill label="En viaje" tone="warning" />
                              ) : null}
                            </div>
                            </div>
                            <p className={styles.vehicleTags}>
                              <span className={styles.vehicleTagPlate}>{vehicle.plate}</span>
                              <span className={styles.vehicleTag}>{vehicle.color}</span>
                              <span className={styles.vehicleTag}>{vehicle.year}</span>
                            </p>
                          </div>

                          <div className={styles.vehicleDetails}>
                            <article className={styles.infoTile}>
                              <span>Tipo</span>
                              <strong>{getVehicleTypeLabel(vehicle.vehicleType)}</strong>
                            </article>
                            <article className={styles.infoTile}>
                              <span>Cupos</span>
                              <strong>{vehicle.seatCount} asientos</strong>
                            </article>
                            <article className={styles.infoTile}>
                              <span>Equipaje</span>
                              <strong>{getLuggagePolicyLabel(vehicle.luggagePolicy)}</strong>
                            </article>
                          </div>

                          <div className={styles.vehicleDocumentRow}>
                            <div className={styles.documentRowInfo}>
                              <span className={styles.documentRowLabel}>Matricula</span>
                              <strong className={styles.documentName}>
                                {hasRegistrationDocument ? 'Documento registrado' : 'Sin archivo'}
                              </strong>
                            </div>
                            
                            {hasRegistrationDocument ? (
                              <div className={styles.documentRowActions}>
                                <button
                                  className={styles.actionBtnSecondary}
                                  disabled={previewLoadingVehicleId === vehicle.id}
                                  onClick={() => void handlePreviewStoredVehicleDocument(vehicle)}
                                  type="button"
                                >
                                  {previewLoadingVehicleId === vehicle.id ? 'Abriendo...' : 'Ver'}
                                </button>
                                <button
                                  className={styles.actionBtnGhost}
                                  disabled={downloadingVehicleId === vehicle.id}
                                  onClick={() => void handleDownloadStoredVehicleDocument(vehicle)}
                                  type="button"
                                >
                                  {downloadingVehicleId === vehicle.id ? 'Descargando...' : 'Descargar'}
                                </button>
                              </div>
                            ) : null}
                          </div>

                          <div className={styles.vehicleActions}>
                            <button
                              className={styles.actionBtnSecondary}
                              disabled={!vehicleManagementEnabled}
                              onClick={() => openEditVehicleModal(vehicle)}
                              type="button"
                            >
                              Editar
                            </button>
                            <button
                              className={vehicle.isActive ? styles.actionBtnSecondary : styles.actionBtnPrimary}
                              disabled={
                                !vehicleManagementEnabled ||
                                isBusy ||
                                (vehicle.isActive && isLockedByTrips)
                              }
                              onClick={() => void handleToggleVehicleStatus(vehicle)}
                              type="button"
                            >
                              {isBusy
                                ? 'Actualizando...'
                                : vehicle.isActive
                                  ? 'Desactivar'
                                  : 'Activar'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.emptyStateCard}>
                    <strong>Aun no tienes vehiculos registrados.</strong>
                    <span>Empieza agregando tu primera unidad.</span>
                  </div>
                )}
              </article>
            </div>

            <aside className={styles.sideColumn}>
              <article className={`${styles.sideCard} ${styles.reveal}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.kicker}>Estado</p>
                    <h2>Condicion actual</h2>
                  </div>
                  <StatusPill
                    label={licenseStatus === DriverLicenseStatus.Expired ? 'Atencion' : 'Actual'}
                    tone={licenseStatus === DriverLicenseStatus.Expired ? 'warning' : 'success'}
                  />
                </div>

                <div className={styles.noticeStack}>
                  <div className={styles.noticeCard}>
                    <strong>Conductor</strong>
                    <span>{getDriverStatusLabel(currentStatus)}</span>
                  </div>
                  <div className={styles.noticeCard}>
                    <strong>Licencia</strong>
                    <span>{licenseAlertMessage ?? 'Sin alertas activas.'}</span>
                  </div>
                  <div className={styles.noticeCard}>
                    <strong>Uso actual</strong>
                    <span>{vehiclesWithTrips} vehiculo(s) con viajes en curso.</span>
                  </div>
                </div>
              </article>
            </aside>
          </section>
          </div>
        </section>
      )}

      {isRegistrationModalOpen ? (
        <div
          aria-labelledby="vehicle-registration-modal-title"
          aria-modal="true"
          className={styles.modalBackdrop}
          onClick={closeRegistrationModal}
          role="dialog"
        >
          <div
            className={styles.modalCanvas}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.kicker}>Vehiculo</p>
                <h2 className={styles.modalTitle} id="vehicle-registration-modal-title">
                  {editingVehicle ? 'Editar vehiculo' : 'Registrar vehiculo'}
                </h2>
                <p className={styles.modalText}>
                  Completa los datos y carga la matricula cuando corresponda.
                </p>
              </div>
              <button
                className={styles.actionBtnSecondary}
                disabled={isSubmitting}
                onClick={closeRegistrationModal}
                type="button"
              >
                Cerrar
              </button>
            </div>

            <form className={styles.registrationForm} onSubmit={handleSubmit}>
              <section className={styles.formSection}>
                <div className={styles.formSectionHeader}>
                  <div>
                    <p className={styles.kicker}>Datos base</p>
                    <h3>Informacion del vehiculo</h3>
                  </div>
                  <StatusPill
                    label={editingVehicle ? 'Edicion' : 'Nuevo'}
                    tone="neutral"
                  />
                </div>

                <div className={styles.formGrid}>
                  <SelectField
                    label="Tipo de vehiculo"
                    onChange={(event) =>
                      handleFormChange('vehicleType', event.target.value as VehicleType)
                    }
                    required
                    value={formValues.vehicleType}
                  >
                    <option value={VehicleType.Motorcycle}>
                      {getVehicleTypeLabel(VehicleType.Motorcycle)}
                    </option>
                    <option value={VehicleType.Car}>
                      {getVehicleTypeLabel(VehicleType.Car)}
                    </option>
                    <option value={VehicleType.PickupTruck}>
                      {getVehicleTypeLabel(VehicleType.PickupTruck)}
                    </option>
                  </SelectField>

                  <InputField
                    label="Anio"
                    onChange={(event) => handleFormChange('year', event.target.value)}
                    placeholder="2024"
                    required
                    type="number"
                    value={formValues.year}
                  />
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.fieldPanel}>
                    <div className={styles.fieldPanelHeader}>
                      <span className={styles.fieldPanelLabel}>Marca</span>
                      <button
                        className={styles.textAction}
                        onClick={toggleManualBrand}
                        type="button"
                      >
                        {isManualBrand ? 'Usar catalogo' : 'Ingresar manualmente'}
                      </button>
                    </div>

                    {isManualBrand ? (
                      <input
                        className="input"
                        onChange={(event) =>
                          handleFormChange('customBrandName', event.target.value)
                        }
                        placeholder="Ej. Kia"
                        value={formValues.customBrandName}
                      />
                    ) : (
                      <select
                        className="input"
                        onChange={(event) => handleFormChange('brandId', event.target.value)}
                        value={formValues.brandId}
                      >
                        <option value="">Selecciona una marca</option>
                        {brands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className={styles.fieldPanel}>
                    <div className={styles.fieldPanelHeader}>
                      <span className={styles.fieldPanelLabel}>Modelo</span>
                      <button
                        className={styles.textAction}
                        onClick={toggleManualModel}
                        type="button"
                      >
                        {isManualModel ? 'Usar catalogo' : 'Ingresar manualmente'}
                      </button>
                    </div>

                    {isManualModel ? (
                      <input
                        className="input"
                        onChange={(event) =>
                          handleFormChange('customModelName', event.target.value)
                        }
                        placeholder="Ej. Rio"
                        value={formValues.customModelName}
                      />
                    ) : (
                      <select
                        className="input"
                        onChange={(event) => handleFormChange('modelId', event.target.value)}
                        value={formValues.modelId}
                      >
                        <option value="">Selecciona un modelo</option>
                        {models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <InputField
                    label="Color"
                    onChange={(event) => handleFormChange('color', event.target.value)}
                    placeholder="Blanco"
                    required
                    value={formValues.color}
                  />
                  <InputField
                    label="Placa"
                    onChange={(event) => handleFormChange('plate', event.target.value.toUpperCase())}
                    placeholder="ABC-1234"
                    required
                    value={formValues.plate}
                  />
                </div>

                <div className={styles.formGrid}>
                  <InputField
                    label="Cupos"
                    onChange={(event) => handleFormChange('seatCount', event.target.value)}
                    placeholder="4"
                    required
                    type="number"
                    value={formValues.seatCount}
                  />
                  <SelectField
                    label="Equipaje"
                    onChange={(event) =>
                      handleFormChange('luggagePolicy', event.target.value as LuggagePolicy)
                    }
                    required
                    value={formValues.luggagePolicy}
                  >
                    <option value={LuggagePolicy.NotAllowed}>
                      {getLuggagePolicyLabel(LuggagePolicy.NotAllowed)}
                    </option>
                    <option value={LuggagePolicy.SmallOnly}>
                      {getLuggagePolicyLabel(LuggagePolicy.SmallOnly)}
                    </option>
                    <option value={LuggagePolicy.UpToMedium}>
                      {getLuggagePolicyLabel(LuggagePolicy.UpToMedium)}
                    </option>
                    <option value={LuggagePolicy.LargeAllowed}>
                      {getLuggagePolicyLabel(LuggagePolicy.LargeAllowed)}
                    </option>
                  </SelectField>
                </div>
              </section>

              <section className={styles.formSection}>
                <div className={styles.formSectionHeader}>
                  <div>
                    <p className={styles.kicker}>Documento</p>
                    <h3>Matricula</h3>
                  </div>
                  <StatusPill
                    label={
                      formValues.registrationDocumentFileKey ? 'Cargado' : 'Pendiente'
                    }
                    tone={
                      formValues.registrationDocumentFileKey ? 'success' : 'warning'
                    }
                  />
                </div>

                <div className={styles.documentCard}>
                  <div>
                    <strong>Documento de matricula</strong>
                    <p className={styles.documentDescription}>
                      PDF, JPG, PNG o WEBP.
                    </p>
                    <span className={styles.documentFileName}>
                      {currentFormDocumentFileName ?? 'Sin archivo cargado'}
                    </span>
                  </div>

                  <div className={styles.documentActions}>
                    <label
                      className={styles.actionBtnPrimary}
                      htmlFor={
                        isUploadingRegistrationDocument
                          ? undefined
                          : 'vehicle-registration-document'
                      }
                      onClick={() => {
                        if (!isUploadingRegistrationDocument) {
                          suppressAuthSessionSync();
                        }
                      }}
                    >
                      {isUploadingRegistrationDocument
                        ? 'Subiendo...'
                        : currentFormDocumentFileName
                          ? 'Cambiar archivo'
                          : 'Subir archivo'}
                    </label>

                    <input
                      accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
                      className={styles.srOnly}
                      id="vehicle-registration-document"
                      onChange={(event) => {
                        const selectedFile = event.target.files?.[0];

                        if (!selectedFile) {
                          return;
                        }

                        if (!allowedVehicleDocumentMimeTypes.has(selectedFile.type)) {
                          handleUploadValidationError(
                            'El documento debe estar en PDF, JPG, PNG o WEBP.',
                          );
                          event.target.value = '';
                          return;
                        }

                        if (selectedFile.size > maxVehicleDocumentSizeBytes) {
                          handleUploadValidationError(
                            'El documento no puede superar los 8 MB.',
                          );
                          event.target.value = '';
                          return;
                        }

                        void handleUploadRegistrationDocument(selectedFile);
                        event.target.value = '';
                      }}
                      type="file"
                    />

                    <button
                      className={styles.actionBtnSecondary}
                      disabled={
                        !formValues.registrationDocumentFileKey ||
                        isOpeningRegistrationDocumentPreview
                      }
                      onClick={() => void handlePreviewRegistrationDocument()}
                      type="button"
                    >
                      {isOpeningRegistrationDocumentPreview ? 'Abriendo...' : 'Ver'}
                    </button>
                    <button
                      className={styles.actionBtnGhost}
                      disabled={
                        !formValues.registrationDocumentFileKey ||
                        isDownloadingRegistrationDocument
                      }
                      onClick={() => void handleDownloadRegistrationDocument()}
                      type="button"
                    >
                      {isDownloadingRegistrationDocument ? 'Descargando...' : 'Descargar'}
                    </button>
                  </div>
                </div>
              </section>

              <div className={styles.modalActions}>
                <button
                  className={styles.actionBtnGhost}
                  disabled={isSubmitting}
                  onClick={closeRegistrationModal}
                  type="button"
                >
                  Cancelar
                </button>
                <button className={styles.actionBtnPrimary} disabled={isSubmitting} type="submit">
                  {isSubmitting
                    ? 'Guardando...'
                    : editingVehicle
                      ? 'Guardar cambios'
                      : 'Registrar vehiculo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <FilePreviewModal
        description={
          previewState?.mimeType?.startsWith('image/')
            ? 'Revisa la imagen antes de continuar.'
            : 'Revisa el documento antes de descargarlo.'
        }
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
        isOpen={Boolean(previewState)}
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
