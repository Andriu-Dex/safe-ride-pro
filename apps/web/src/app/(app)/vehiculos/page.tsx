'use client';

import Link from 'next/link';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  LuggagePolicy,
  VehicleType,
} from '@saferidepro/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { FilePreviewModal } from '../../../components/ui/file-preview-modal';
import { OperationalAccessCard } from '../../../components/ui/operational-access-card';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastStack, type ToastItem } from '../../../components/ui/toast-stack';
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

type VehicleActionIconName =
  | 'register'
  | 'fleet'
  | 'preview'
  | 'download'
  | 'edit'
  | 'activate'
  | 'deactivate';

function VehicleActionIcon({ name }: { name: VehicleActionIconName }) {
  const iconClassName = ['vehicle-action-icon', `vehicle-action-icon-${name}`].join(' ');

  switch (name) {
    case 'register':
      return (
        <svg aria-hidden="true" className={iconClassName} viewBox="0 0 16 16">
          <path d="M8 3v10M3 8h10" />
        </svg>
      );
    case 'fleet':
      return (
        <svg aria-hidden="true" className={iconClassName} viewBox="0 0 16 16">
          <rect x="2" y="3" width="12" height="8" rx="2" />
          <circle cx="5" cy="12" r="1" />
          <circle cx="11" cy="12" r="1" />
        </svg>
      );
    case 'preview':
      return (
        <svg aria-hidden="true" className={iconClassName} viewBox="0 0 16 16">
          <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      );
    case 'download':
      return (
        <svg aria-hidden="true" className={iconClassName} viewBox="0 0 16 16">
          <path d="M8 2v7" />
          <path d="m5.5 7.5 2.5 2.5 2.5-2.5" />
          <path d="M3 12.5h10" />
        </svg>
      );
    case 'edit':
      return (
        <svg aria-hidden="true" className={iconClassName} viewBox="0 0 16 16">
          <path d="m3 11 6.8-6.8 2 2L5 13H3v-2Z" />
          <path d="m9.2 4.2 1.2-1.2a1 1 0 0 1 1.4 0l1.2 1.2a1 1 0 0 1 0 1.4L11.8 6.8" />
        </svg>
      );
    case 'activate':
      return (
        <svg aria-hidden="true" className={iconClassName} viewBox="0 0 16 16">
          <path d="m3.5 8 2.4 2.4 6.6-6.6" />
        </svg>
      );
    case 'deactivate':
      return (
        <svg aria-hidden="true" className={iconClassName} viewBox="0 0 16 16">
          <path d="M4 4 12 12" />
          <path d="M12 4 4 12" />
        </svg>
      );
    default:
      return null;
  }
}

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
  const [workspaceView, setWorkspaceView] = useState<'register' | 'fleet'>('register');
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [lastBlockingToastKey, setLastBlockingToastKey] = useState<string | null>(null);

  const pushToast = useCallback((title: string, description: string, tone: ToastItem['tone']) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `vehicle-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

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

  const openRegistrationModal = () => {
    if (!vehicleManagementEnabled) {
      pushToast(
        'Operacion restringida',
        licenseStatus === DriverLicenseStatus.Expired
          ? 'Licencia vencida. Actualiza tu solicitud de conductor para volver a operar.'
          : 'Debes iniciar o aprobar tu proceso de conductor antes de gestionar vehiculos.',
        'info',
      );
      return;
    }

    resetFormState();
    setIsRegistrationModalOpen(true);
  };

  const openEditVehicleModal = (vehicle: VehicleRecord) => {
    void (async () => {
      await startEditingVehicle(vehicle);
      setIsRegistrationModalOpen(true);
    })();
  };

  const handleCloseRegistrationModal = () => {
    setIsRegistrationModalOpen(false);
    resetFormState();
  };

  const startEditingVehicle = async (vehicle: VehicleRecord) => {
    setWorkspaceView('fleet');
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
      pushToast('Vehiculo actualizado', response.message, 'success');
      resetFormState();
      setIsRegistrationModalOpen(false);
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
      pushToast(
        'Operacion no completada',
        error instanceof ApiError
          ? error.message
          : editingVehicleId
            ? 'No fue posible actualizar el vehiculo.'
            : 'No fue posible registrar el vehiculo.',
        'error',
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
      pushToast('Estado actualizado', response.message, 'success');

      if (editingVehicleId === vehicle.id && vehicle.isActive) {
        resetFormState();
        setIsRegistrationModalOpen(false);
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
      pushToast(
        'No se pudo actualizar el estado',
        error instanceof ApiError
          ? error.message
          : 'No fue posible actualizar el estado del vehiculo.',
        'error',
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
  const totalVehicles = vehicleOverview?.vehicles.length ?? 0;
  const activeVehicles =
    vehicleOverview?.vehicles.filter((vehicle) => vehicle.isActive).length ?? 0;
  const vehiclesWithOperationalTrips =
    vehicleOverview?.vehicles.filter((vehicle) => vehicle.operationalTripCount > 0).length ?? 0;
  const inactiveVehicles = Math.max(totalVehicles - activeVehicles, 0);
  const vehiclesPendingDocument =
    vehicleOverview?.vehicles.filter((vehicle) => !vehicle.registrationDocumentFileKey).length ??
    0;
  const licenseAlertMessage = getDriverLicenseAlertMessage(
    licenseStatus,
    vehicleOverview?.membership?.licenseExpiresInDays,
  );

  useEffect(() => {
    if (isLoading) {
      return;
    }

    setWorkspaceView(totalVehicles > 0 ? 'fleet' : 'register');
  }, [isLoading, totalVehicles]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!vehicleManagementEnabled) {
      const description =
        licenseStatus === DriverLicenseStatus.Expired
          ? 'Licencia vencida. Actualiza tu solicitud para gestionar tu flota.'
          : 'Debes iniciar o aprobar tu proceso de conductor antes de gestionar vehiculos.';
      const nextKey = `blocked:${description}`;

      if (lastBlockingToastKey !== nextKey) {
        pushToast('Gestion de flota limitada', description, 'info');
        setLastBlockingToastKey(nextKey);
      }

      return;
    }

    if (licenseAlertMessage) {
      const nextKey = `license:${licenseAlertMessage}`;

      if (lastBlockingToastKey !== nextKey) {
        pushToast('Atencion con tu licencia', licenseAlertMessage, 'info');
        setLastBlockingToastKey(nextKey);
      }

      return;
    }

    setLastBlockingToastKey(null);
  }, [
    isLoading,
    lastBlockingToastKey,
    licenseAlertMessage,
    licenseStatus,
    pushToast,
    vehicleManagementEnabled,
  ]);

  if (
    !isLoading &&
    !operationalAccess.hasOperationalMembership &&
    operationalAccess.title &&
    operationalAccess.message
  ) {
    return (
      <section className="vehicle-shell">
        <section className="vehicle-command">
          <div className="vehicle-command-copy">
            <span className="section-label">Flota del conductor</span>
            <h1 className="vehicle-command-title">Gestion de vehiculos</h1>
            <p className="vehicle-command-subtitle">
              Registra y gestiona los vehiculos asociados a tu perfil de conductor.
            </p>
          </div>
          <div className="vehicle-command-actions">
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
    <>
      <section className="vehicle-shell">
        <section className="vehicle-command">
          <div className="vehicle-command-copy">
            <span className="section-label">Flota del conductor</span>
            <h1 className="vehicle-command-title">Gestion de vehiculos</h1>
            <p className="vehicle-command-subtitle">Controla tu flota en una vista clara y rapida.</p>
          </div>
          <div className="vehicle-command-actions">
            <StatusPill
              label={getDriverStatusLabel(driverStatus)}
              tone={getDriverStatusTone(driverStatus)}
            />
            <StatusPill label={`${totalVehicles} registrados`} tone="neutral" />
          </div>
        </section>

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
          <>
            <section className="vehicle-kpi-grid">
              <article className="vehicle-kpi-card">
                <span className="vehicle-kpi-label">Registrados</span>
                <strong className="vehicle-kpi-value">{totalVehicles}</strong>
                <p className="vehicle-kpi-note">Flota total.</p>
              </article>
              <article className="vehicle-kpi-card">
                <span className="vehicle-kpi-label">Activos</span>
                <strong className="vehicle-kpi-value">{activeVehicles}</strong>
                <p className="vehicle-kpi-note">Listos para viaje.</p>
              </article>
              <article className="vehicle-kpi-card">
                <span className="vehicle-kpi-label">En pausa</span>
                <strong className="vehicle-kpi-value">{inactiveVehicles}</strong>
                <p className="vehicle-kpi-note">No disponibles.</p>
              </article>
              <article className="vehicle-kpi-card">
                <span className="vehicle-kpi-label">Con viajes operativos</span>
                <strong className="vehicle-kpi-value">{vehiclesWithOperationalTrips}</strong>
                <p className="vehicle-kpi-note">
                  {vehiclesPendingDocument > 0
                    ? `${vehiclesPendingDocument} con docs pendientes.`
                    : 'Documentacion al dia.'}
                </p>
              </article>
            </section>

            <section className="vehicle-workspace-switch" aria-label="Vistas de gestion vehicular">
              <button
                className={[
                  'vehicle-view-chip',
                  workspaceView === 'register' ? 'vehicle-view-chip-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setWorkspaceView('register')}
                type="button"
              >
                <span className="vehicle-view-chip-icon" aria-hidden="true">
                  <VehicleActionIcon name="register" />
                </span>
                <span>Registro</span>
                <strong>{editingVehicleId ? 'Edicion activa' : 'Nuevo vehiculo'}</strong>
              </button>
              <button
                className={[
                  'vehicle-view-chip',
                  workspaceView === 'fleet' ? 'vehicle-view-chip-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setWorkspaceView('fleet')}
                type="button"
              >
                <span className="vehicle-view-chip-icon" aria-hidden="true">
                  <VehicleActionIcon name="fleet" />
                </span>
                <span>Mi flota</span>
                <strong>{totalVehicles} vehiculo(s)</strong>
              </button>
            </section>

            {workspaceView === 'register' ? (
              <section className="vehicle-main-grid vehicle-main-grid-register">
                <article className="panel panel-stack vehicle-register-launch-card">
                  <div className="panel-header-row">
                    <div>
                      <h2 className="panel-title">Registro de vehiculo</h2>
                      <p className="panel-text">Abre el formulario cuando lo necesites.</p>
                    </div>
                    <Button onClick={openRegistrationModal} variant="primary">
                      <VehicleActionIcon name="register" />
                      Abrir formulario
                    </Button>
                  </div>

                  <div className="vehicle-register-launch-grid">
                    <article className="vehicle-register-launch-metric">
                      <span>Estado</span>
                      <strong>{vehicleManagementEnabled ? 'Habilitado' : 'Restringido'}</strong>
                    </article>
                    <article className="vehicle-register-launch-metric">
                      <span>Flota</span>
                      <strong>{totalVehicles} unidad(es)</strong>
                    </article>
                    <article className="vehicle-register-launch-metric">
                      <span>Activos</span>
                      <strong>{activeVehicles}</strong>
                    </article>
                  </div>
                </article>

                <aside className="vehicle-side-stack">
                  <article className="vehicle-focus-card">
                    <div className="vehicle-guide-head">
                      <h2 className="panel-title">Acciones rapidas</h2>
                      <StatusPill
                        label={vehicleManagementEnabled ? 'Operacion habilitada' : 'Operacion limitada'}
                        tone={vehicleManagementEnabled ? 'success' : 'warning'}
                      />
                    </div>

                    <div className="vehicle-guide-grid">
                      <Link className="vehicle-guide-link" href="/conductor">
                        <strong>Estado de conductor</strong>
                        <span>Revisar habilitacion.</span>
                      </Link>
                      <Link className="vehicle-guide-link" href="/viajes">
                        <strong>Ir a viajes</strong>
                        <span>Publicar con tu flota activa.</span>
                      </Link>
                      <Link className="vehicle-guide-link" href="/perfil">
                        <strong>Perfil</strong>
                        <span>Actualizar datos de cuenta.</span>
                      </Link>
                    </div>
                  </article>

                  {vehicleOverview?.vehicles.length ? (
                    <article className="panel panel-stack">
                      <div className="panel-header-row">
                        <h2 className="panel-title">Flota actual</h2>
                        <Button onClick={() => setWorkspaceView('fleet')} variant="secondary">
                          Ver flota
                        </Button>
                      </div>

                      <div className="list-stack">
                        {vehicleOverview.vehicles.slice(0, 3).map((vehicle) => (
                          <div key={vehicle.id} className="list-card list-card-compact">
                            <div className="list-card-header">
                              <strong>{getVehicleDisplayName(vehicle)}</strong>
                              <div className="vehicle-status-row">
                                <span
                                  aria-hidden="true"
                                  className={[
                                    'vehicle-status-glyph',
                                    vehicle.isActive
                                      ? 'vehicle-status-glyph-success'
                                      : 'vehicle-status-glyph-warning',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                >
                                  <VehicleActionIcon
                                    name={vehicle.isActive ? 'activate' : 'deactivate'}
                                  />
                                </span>
                                <StatusPill
                                  label={vehicle.isActive ? 'Activo' : 'Inactivo'}
                                  tone={vehicle.isActive ? 'success' : 'warning'}
                                />
                              </div>
                            </div>
                            <div className="button-row">
                              <Button onClick={() => openEditVehicleModal(vehicle)} variant="ghost">
                                <VehicleActionIcon name="edit" />
                                Editar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ) : null}
                </aside>
              </section>
            ) : (
              <section className="vehicle-main-grid vehicle-main-grid-fleet">
                <article className="panel panel-stack">
                  <div className="panel-header-row">
                    <h2 className="panel-title">Mi flota</h2>
                    <Button onClick={openRegistrationModal} variant="secondary">
                      <VehicleActionIcon name="register" />
                      Registrar vehiculo
                    </Button>
                  </div>

                  {vehicleOverview?.vehicles.length ? (
                    <div
                      className={[
                        'list-stack',
                        'vehicle-fleet-list',
                        totalVehicles >= 6 ? 'vehicle-fleet-list-compact' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {vehicleOverview.vehicles.map((vehicle) => {
                        const isBusy = isTogglingVehicleId === vehicle.id;
                        const isLockedByTrips = vehicle.operationalTripCount > 0;
                        const isEditingCurrentVehicle = editingVehicleId === vehicle.id;
                        const hasRegistrationDocument = Boolean(vehicle.registrationDocumentFileKey);

                        return (
                          <div key={vehicle.id} className="list-card vehicle-fleet-card">
                            <div className="list-card-header">
                              <strong>{getVehicleDisplayName(vehicle)}</strong>
                              <div className="button-row vehicle-status-row">
                                <span
                                  aria-hidden="true"
                                  className={[
                                    'vehicle-status-glyph',
                                    vehicle.isActive
                                      ? 'vehicle-status-glyph-success'
                                      : 'vehicle-status-glyph-warning',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                >
                                  <VehicleActionIcon
                                    name={vehicle.isActive ? 'activate' : 'deactivate'}
                                  />
                                </span>
                                <StatusPill
                                  label={vehicle.isActive ? 'Activo' : 'Inactivo'}
                                  tone={vehicle.isActive ? 'success' : 'warning'}
                                />
                                {isLockedByTrips ? (
                                  <StatusPill label="En viaje" tone="warning" />
                                ) : null}
                              </div>
                            </div>

                            <div className="analytics-detail-grid vehicle-fleet-detail-grid">
                              <div className="analytics-detail-card">
                                <span>Tipo</span>
                                <strong>{getVehicleTypeLabel(vehicle.vehicleType)}</strong>
                                <p>{vehicle.seatCount} cupos</p>
                              </div>
                              <div className="analytics-detail-card">
                                <span>Placa</span>
                                <strong>{vehicle.plate}</strong>
                                <p>{vehicle.color} | {vehicle.year}</p>
                              </div>
                              <div className="analytics-detail-card">
                                <span>Documento</span>
                                <strong>{hasRegistrationDocument ? 'OK' : 'Pendiente'}</strong>
                                <p>{hasRegistrationDocument ? 'Disponible' : 'Requerido'}</p>
                              </div>
                            </div>

                            {isLockedByTrips ? (
                              <div className="form-helper">Bloqueado mientras tenga viajes operativos.</div>
                            ) : null}

                            <div className="vehicle-fleet-footer">
                              {hasRegistrationDocument ? (
                                <div className="button-row vehicle-fleet-actions vehicle-fleet-doc-actions">
                                  <Button
                                    className="vehicle-fleet-btn vehicle-fleet-btn-doc-view"
                                    disabled={previewLoadingVehicleId === vehicle.id}
                                    onClick={() => void handlePreviewStoredVehicleDocument(vehicle)}
                                    variant="secondary"
                                  >
                                    <VehicleActionIcon name="preview" />
                                    {previewLoadingVehicleId === vehicle.id
                                      ? 'Abriendo...'
                                      : 'Ver documento'}
                                  </Button>
                                  <Button
                                    className="vehicle-fleet-btn vehicle-fleet-btn-doc-download"
                                    disabled={downloadingVehicleId === vehicle.id}
                                    onClick={() => void handleDownloadStoredVehicleDocument(vehicle)}
                                    variant="ghost"
                                  >
                                    <VehicleActionIcon name="download" />
                                    {downloadingVehicleId === vehicle.id
                                      ? 'Descargando...'
                                      : 'Descargar'}
                                  </Button>
                                </div>
                              ) : null}

                              <div className="button-row vehicle-fleet-actions vehicle-fleet-main-actions">
                                <Button
                                  className="vehicle-fleet-btn vehicle-fleet-btn-edit"
                                  disabled={!vehicleManagementEnabled || isLockedByTrips}
                                  onClick={() => openEditVehicleModal(vehicle)}
                                  variant="primary"
                                >
                                  <VehicleActionIcon name="edit" />
                                  {isEditingCurrentVehicle ? 'Editando' : 'Editar'}
                                </Button>
                                <Button
                                  className={[
                                    'vehicle-fleet-btn',
                                    'vehicle-fleet-btn-toggle',
                                    vehicle.isActive
                                      ? 'vehicle-fleet-btn-toggle-deactivate'
                                      : 'vehicle-fleet-btn-toggle-activate',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  disabled={
                                    !vehicleManagementEnabled ||
                                    isBusy ||
                                    (vehicle.isActive && isLockedByTrips)
                                  }
                                  onClick={() => void handleToggleVehicleStatus(vehicle)}
                                  variant="secondary"
                                >
                                  <VehicleActionIcon
                                    name={vehicle.isActive ? 'deactivate' : 'activate'}
                                  />
                                  {isBusy
                                    ? 'Actualizando...'
                                    : vehicle.isActive
                                      ? 'Desactivar'
                                      : 'Activar'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="form-helper form-helper-strong vehicle-fleet-empty-state">
                      Aun no hay vehiculos registrados.
                    </div>
                  )}
                </article>

                <aside className="vehicle-side-stack">
                  <article className="vehicle-focus-card">
                    <h2 className="panel-title">Resumen rapido</h2>
                    <dl className="vehicle-metric-list">
                      <div>
                        <dt>Activos</dt>
                        <dd>{activeVehicles}</dd>
                      </div>
                      <div>
                        <dt>En pausa</dt>
                        <dd>{inactiveVehicles}</dd>
                      </div>
                      <div>
                        <dt>Operativos</dt>
                        <dd>{vehiclesWithOperationalTrips}</dd>
                      </div>
                    </dl>
                  </article>

                  <article className="vehicle-focus-card">
                    <h2 className="panel-title">Siguiente paso</h2>
                    <div className="vehicle-guide-grid">
                      <Link className="vehicle-guide-link" href="/viajes">
                        <strong>Crear viaje</strong>
                        <span>Usar un vehiculo activo.</span>
                      </Link>
                      <Link className="vehicle-guide-link" href="/conductor">
                        <strong>Ver estado</strong>
                        <span>Confirmar habilitacion.</span>
                      </Link>
                    </div>
                  </article>
                </aside>
              </section>
            )}
          </>
        )}
      </section>

      {isRegistrationModalOpen ? (
        <div
          aria-labelledby="vehicle-registration-modal-title"
          aria-modal="true"
          className="modal-backdrop"
          onClick={handleCloseRegistrationModal}
          role="dialog"
        >
          <div
            className="modal-card modal-card-lg vehicle-registration-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="modal-header">
              <div>
                <h2 className="panel-title" id="vehicle-registration-modal-title">
                  {editingVehicle ? 'Editar vehiculo' : 'Registrar vehiculo'}
                </h2>
                <p className="panel-text">Formulario de gestion vehicular.</p>
              </div>
              <Button onClick={handleCloseRegistrationModal} variant="ghost">
                Cerrar
              </Button>
            </div>

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
              onCancelEdit={handleCloseRegistrationModal}
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
          </div>
        </div>
      ) : null}

      <ToastStack onDismiss={dismissToast} toasts={toasts} />

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
