'use client';

import Link from 'next/link';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  InstitutionMembershipRole,
} from '@saferidepro/shared-types';
import { useEffect, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { FilePreviewModal } from '../../../components/ui/file-preview-modal';
import { InputField } from '../../../components/ui/input-field';
import { OperationalAccessCard } from '../../../components/ui/operational-access-card';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { downloadBlobFile } from '../../../lib/blob-file';
import { ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../modules/auth/lib/operational-context';
import {
  downloadDriverApplicationDocument,
  getDriverOverview,
  listDriverLicenseTypes,
  submitDriverApplication,
  uploadDriverDocument,
} from '../../../modules/driver/lib/driver-api';
import { buildDriverDocumentFileName } from '../../../modules/driver/lib/driver-document-file';
import {
  getDriverLicenseAlertMessage,
  getDriverLicenseStatusLabel,
  getDriverLicenseStatusTone,
  getDriverStatusLabel,
  getDriverStatusTone,
} from '../../../modules/driver/lib/driver-status';
import type {
  DriverDocumentType,
  DriverOverview,
  LicenseTypeCatalogItem,
} from '../../../modules/driver/types/driver';
import { suppressAuthSessionSync } from '../../../modules/auth/lib/auth-sync-guard';
import styles from './page.module.css';

const emptyForm = {
  licenseTypeId: '',
  licenseExpiresAt: '',
  identityDocumentFileKey: '',
  licenseDocumentFileKey: '',
};

const maxDriverDocumentSizeBytes = 8 * 1024 * 1024;
const allowedDriverDocumentMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

type DriverFormValues = typeof emptyForm;

type PreviewState = {
  documentType: DriverDocumentType;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  title: string;
};

function toDateInputValue(isoDate?: string | null): string {
  if (!isoDate) {
    return '';
  }

  return isoDate.slice(0, 10);
}

function extractUploadedFileName(fileKey?: string | null): string | null {
  if (!fileKey) {
    return null;
  }

  const segments = fileKey.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? fileKey;
}

function getDocumentTitle(documentType: DriverDocumentType): string {
  return documentType === 'identity'
    ? 'Documento de identidad'
    : 'Documento de licencia';
}

function getDocumentLabel(documentType: DriverDocumentType): string {
  return documentType === 'identity' ? 'Identidad' : 'Licencia';
}

function getApplicationActionLabel(status: DriverVerificationStatus): string {
  switch (status) {
    case DriverVerificationStatus.Rejected:
    case DriverVerificationStatus.Suspended:
      return 'Reenviar solicitud';
    case DriverVerificationStatus.PendingVerification:
      return 'Actualizar solicitud';
    default:
      return 'Enviar solicitud';
  }
}

function buildValidationMessage(values: DriverFormValues): string | null {
  if (!values.licenseTypeId) {
    return 'Selecciona el tipo de licencia.';
  }

  if (!values.licenseExpiresAt) {
    return 'Indica la fecha de expiracion de la licencia.';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expirationDate = new Date(values.licenseExpiresAt);

  if (expirationDate < today) {
    return 'La licencia registrada ya esta vencida.';
  }

  if (!values.identityDocumentFileKey.trim()) {
    return 'Carga tu documento de identidad.';
  }

  if (!values.licenseDocumentFileKey.trim()) {
    return 'Carga tu documento de licencia.';
  }

  return null;
}

type DocumentCardProps = {
  documentType: DriverDocumentType;
  fileName: string | null;
  hasFile: boolean;
  isBusy: boolean;
  isDownloading: boolean;
  onFileSelect: (documentType: DriverDocumentType, file: File) => void;
  onPreview: (documentType: DriverDocumentType) => void;
  onDownload: (documentType: DriverDocumentType) => void;
  onValidationError: (message: string) => void;
};

function DocumentCard({
  documentType,
  fileName,
  hasFile,
  isBusy,
  isDownloading,
  onFileSelect,
  onPreview,
  onDownload,
  onValidationError,
}: DocumentCardProps) {
  const inputId = `driver-document-${documentType}`;

  return (
    <article className={styles.documentCard}>
      <div className={styles.documentHead}>
        <div>
          <p className={styles.documentLabel}>{getDocumentLabel(documentType)}</p>
          <h3 className={styles.documentTitle}>{getDocumentTitle(documentType)}</h3>
        </div>
        <StatusPill
          label={hasFile ? 'Cargado' : 'Pendiente'}
          tone={hasFile ? 'success' : 'warning'}
        />
      </div>

      <p className={styles.documentFileName}>
        {fileName ?? 'Sin archivo cargado'}
      </p>

      <div className={styles.documentActions}>
        <label
          className={styles.actionBtnPrimary}
          htmlFor={isBusy ? undefined : inputId}
          onClick={() => {
            if (!isBusy) {
              suppressAuthSessionSync();
            }
          }}
        >
          {isBusy ? 'Subiendo...' : hasFile ? 'Cambiar archivo' : 'Subir archivo'}
        </label>

        <input
          accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
          className={styles.srOnly}
          disabled={isBusy}
          id={inputId}
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];

            if (!selectedFile) {
              return;
            }

            if (!allowedDriverDocumentMimeTypes.has(selectedFile.type)) {
              onValidationError('El documento debe estar en PDF, JPG, PNG o WEBP.');
              event.target.value = '';
              return;
            }

            if (selectedFile.size > maxDriverDocumentSizeBytes) {
              onValidationError('El documento no puede superar los 8 MB.');
              event.target.value = '';
              return;
            }

            onFileSelect(documentType, selectedFile);
            event.target.value = '';
          }}
          type="file"
        />

        <button
          className={styles.actionBtnSecondary}
          disabled={!hasFile || isBusy}
          onClick={() => onPreview(documentType)}
          type="button"
        >
          Ver
        </button>
        <button
          className={styles.actionBtnGhost}
          disabled={!hasFile || isDownloading}
          onClick={() => onDownload(documentType)}
          type="button"
        >
          {isDownloading ? 'Descargando...' : 'Descargar'}
        </button>
      </div>
    </article>
  );
}

export default function DriverPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const [driverOverview, setDriverOverview] = useState<DriverOverview | null>(null);
  const [licenseTypes, setLicenseTypes] = useState<LicenseTypeCatalogItem[]>([]);
  const [formValues, setFormValues] = useState<DriverFormValues>(emptyForm);
  const [identityFileName, setIdentityFileName] = useState<string | null>(null);
  const [licenseFileName, setLicenseFileName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [isUploadingIdentityDocument, setIsUploadingIdentityDocument] = useState(false);
  const [isUploadingLicenseDocument, setIsUploadingLicenseDocument] = useState(false);
  const [isOpeningIdentityPreview, setIsOpeningIdentityPreview] = useState(false);
  const [isOpeningLicensePreview, setIsOpeningLicensePreview] = useState(false);
  const [isDownloadingIdentityDocument, setIsDownloadingIdentityDocument] = useState(false);
  const [isDownloadingLicenseDocument, setIsDownloadingLicenseDocument] = useState(false);
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
        id: `driver-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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

  const syncFormFromOverview = (overview: DriverOverview) => {
    setFormValues({
      licenseTypeId: overview.driverProfile?.licenseType.id ?? '',
      licenseExpiresAt: toDateInputValue(overview.driverProfile?.licenseExpiresAt),
      identityDocumentFileKey: overview.driverProfile?.identityDocumentFileKey ?? '',
      licenseDocumentFileKey: overview.driverProfile?.licenseDocumentFileKey ?? '',
    });
    setIdentityFileName(
      extractUploadedFileName(overview.driverProfile?.identityDocumentFileKey),
    );
    setLicenseFileName(
      extractUploadedFileName(overview.driverProfile?.licenseDocumentFileKey),
    );
  };

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession || !operationalAccess.hasOperationalMembership) {
      setDriverOverview(null);
      setLicenseTypes([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadDriverData = async () => {
      setIsLoading(true);

      try {
        const [overview, licenseTypeItems] = await Promise.all([
          getDriverOverview(authSession.accessToken),
          listDriverLicenseTypes(authSession.accessToken),
        ]);

        if (!isMounted) {
          return;
        }

        setDriverOverview(overview);
        setLicenseTypes(licenseTypeItems);
        syncFormFromOverview(overview);
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
            : 'No fue posible cargar el estado de conductor.',
          'error',
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadDriverData();

    return () => {
      isMounted = false;
    };
  }, [authSession, isHydrated, operationalAccess.hasOperationalMembership, refreshSession]);

  useEffect(() => {
    return () => {
      if (previewState?.fileUrl) {
        URL.revokeObjectURL(previewState.fileUrl);
      }
    };
  }, [previewState]);

  const currentStatus =
    driverOverview?.membership?.effectiveDriverVerificationStatus ??
    driverOverview?.membership?.driverVerificationStatus ??
    DriverVerificationStatus.NotRequested;
  const licenseStatus =
    driverOverview?.driverProfile?.licenseStatus ??
    driverOverview?.membership?.licenseStatus ??
    DriverLicenseStatus.Missing;
  const licenseAlertMessage = getDriverLicenseAlertMessage(
    licenseStatus,
    driverOverview?.driverProfile?.licenseExpiresInDays ??
      driverOverview?.membership?.licenseExpiresInDays,
  );
  const isAdministrativeMembership =
    driverOverview?.membership?.role === InstitutionMembershipRole.InstitutionAdmin;
  const currentMembershipId = driverOverview?.membership?.id ?? null;
  const documentOwnerName =
    driverOverview?.driverProfile?.userFullName ?? authSession?.user.fullName ?? 'usuario';
  const hasDriverProfile = Boolean(driverOverview?.driverProfile);
  const canEditApplication = currentStatus !== DriverVerificationStatus.Approved;
  const validationMessage = buildValidationMessage(formValues);

  const openApplicationModal = () => {
    if (driverOverview) {
      syncFormFromOverview(driverOverview);
    }

    setIsApplicationModalOpen(true);
  };

  const closeApplicationModal = () => {
    setIsApplicationModalOpen(false);

    if (driverOverview) {
      syncFormFromOverview(driverOverview);
    }
  };

  const handleFormChange = (field: keyof DriverFormValues, value: string) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const fetchDriverDocumentBlob = async (
    documentType: DriverDocumentType,
  ): Promise<{ blob: Blob; fileName: string }> => {
    if (!authSession || !currentMembershipId) {
      throw new ApiError('No fue posible identificar la solicitud actual.', 400);
    }

    const blob = await downloadDriverApplicationDocument(
      authSession.accessToken,
      currentMembershipId,
      documentType,
    );

    return {
      blob,
      fileName: buildDriverDocumentFileName(documentType, documentOwnerName, blob.type),
    };
  };

  const handleUploadDocument = async (
    documentType: DriverDocumentType,
    file: File,
  ) => {
    if (!authSession) {
      return;
    }

    if (documentType === 'identity') {
      setIsUploadingIdentityDocument(true);
    } else {
      setIsUploadingLicenseDocument(true);
    }

    try {
      const response = await uploadDriverDocument(
        authSession.accessToken,
        documentType,
        file,
      );

      setFormValues((currentValues) => ({
        ...currentValues,
        identityDocumentFileKey:
          documentType === 'identity'
            ? response.fileKey
            : currentValues.identityDocumentFileKey,
        licenseDocumentFileKey:
          documentType === 'license'
            ? response.fileKey
            : currentValues.licenseDocumentFileKey,
      }));

      if (documentType === 'identity') {
        setIdentityFileName(file.name);
      } else {
        setLicenseFileName(file.name);
      }

      pushToast('Documento cargado', response.message, 'success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo cargar',
        error instanceof ApiError
          ? error.message
          : 'No fue posible cargar el documento.',
        'error',
      );
    } finally {
      if (documentType === 'identity') {
        setIsUploadingIdentityDocument(false);
      } else {
        setIsUploadingLicenseDocument(false);
      }
    }
  };

  const handlePreviewDocument = async (documentType: DriverDocumentType) => {
    if (documentType === 'identity') {
      setIsOpeningIdentityPreview(true);
    } else {
      setIsOpeningLicensePreview(true);
    }

    try {
      const { blob, fileName } = await fetchDriverDocumentBlob(documentType);
      const objectUrl = URL.createObjectURL(blob);

      setPreviewState((currentPreview) => {
        if (currentPreview?.fileUrl) {
          URL.revokeObjectURL(currentPreview.fileUrl);
        }

        return {
          documentType,
          fileName,
          fileUrl: objectUrl,
          mimeType: blob.type,
          title: getDocumentTitle(documentType),
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
      if (documentType === 'identity') {
        setIsOpeningIdentityPreview(false);
      } else {
        setIsOpeningLicensePreview(false);
      }
    }
  };

  const handleDownloadDocument = async (documentType: DriverDocumentType) => {
    if (documentType === 'identity') {
      setIsDownloadingIdentityDocument(true);
    } else {
      setIsDownloadingLicenseDocument(true);
    }

    try {
      const { blob, fileName } = await fetchDriverDocumentBlob(documentType);
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
      if (documentType === 'identity') {
        setIsDownloadingIdentityDocument(false);
      } else {
        setIsDownloadingLicenseDocument(false);
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authSession) {
      return;
    }

    if (validationMessage) {
      pushToast('Revisa tu solicitud', validationMessage, 'info');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await submitDriverApplication(authSession.accessToken, {
        licenseTypeId: formValues.licenseTypeId,
        licenseExpiresAt: formValues.licenseExpiresAt,
        identityDocumentFileKey: formValues.identityDocumentFileKey || undefined,
        licenseDocumentFileKey: formValues.licenseDocumentFileKey || undefined,
      });

      const overview = await getDriverOverview(authSession.accessToken);
      setDriverOverview(overview);
      syncFormFromOverview(overview);
      setIsApplicationModalOpen(false);
      await refreshSession();
      pushToast('Solicitud enviada', response.message, 'success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo enviar',
        error instanceof ApiError
          ? error.message
          : 'No fue posible enviar la solicitud de conductor.',
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
                <p className={styles.kicker}>Conductor</p>
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

  if (!isLoading && isAdministrativeMembership) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.pageBackground}>
          <article className={`${styles.canvas} ${styles.canvasSmall}`}>
            <div className={styles.lockedHeader}>
              <div>
                <p className={styles.kicker}>Conductor</p>
                <h1 className={styles.lockedTitle}>No disponible para esta membresia</h1>
              </div>
              <StatusPill label="Administrativa" tone="warning" />
            </div>
            <p className={styles.lockedText}>
              Usa una membresia operativa para gestionar tu solicitud de conductor.
            </p>
          </article>
        </section>
      </>
    );
  }

  const reviewNotes = driverOverview?.driverProfile?.reviewNotes;
  const submittedAt = driverOverview?.driverProfile?.submittedAt;

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      {isLoading ? (
        <section className={styles.pageBackground}>
          <article className={`${styles.canvas} ${styles.canvasSmall}`}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h2 className={styles.loadingTitle}>Cargando conductor</h2>
            <p className={styles.loadingText}>Estamos consultando tu estado actual.</p>
          </article>
        </section>
      ) : (
        <section className={styles.pageBackground}>
          <div className={`${styles.canvas} ${styles.revealSoft}`}>
            <section className={styles.hero}>
            <div className={styles.heroTop}>
              <div className={styles.heroCopy}>
                <p className={styles.kicker}>Conductor</p>
                <h1 className={styles.heroTitle}>Tu estado operativo</h1>
                <p className={styles.heroLead}>
                  Revisa tu habilitacion, tus documentos y el siguiente paso para operar.
                </p>
              </div>

              <div className={styles.heroPills}>
                <span className={`${styles.heroBadge} ${getBadgeClass(getDriverStatusTone(currentStatus))}`}>
                  {getDriverStatusLabel(currentStatus)}
                </span>
                <span className={`${styles.heroBadge} ${getBadgeClass(getDriverLicenseStatusTone(licenseStatus))}`}>
                  {getDriverLicenseStatusLabel(licenseStatus)}
                </span>
              </div>
            </div>

            <div className={styles.heroActions}>
              {canEditApplication ? (
                <button className={styles.heroBtnPrimary} onClick={openApplicationModal} type="button">
                  {hasDriverProfile
                    ? getApplicationActionLabel(currentStatus)
                    : 'Crear solicitud'}
                </button>
              ) : null}
              <Link className={styles.heroBtnSecondary} href="/vehiculos">
                Ir a vehiculos
              </Link>
              <Link className={styles.heroBtnGhost} href="/viajes">
                Ir a viajes
              </Link>
            </div>
          </section>

          <section className={styles.mainGrid}>
            <div className={styles.contentColumn}>
              <article className={`${styles.summaryCard} ${styles.reveal}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.kicker}>Solicitud</p>
                    <h2>Resumen actual</h2>
                  </div>
                  <StatusPill
                    label={getDriverStatusLabel(currentStatus)}
                    tone={getDriverStatusTone(currentStatus)}
                  />
                </div>

                {hasDriverProfile ? (
                  <div className={styles.summaryGrid}>
                    <article className={styles.infoTile}>
                      <span>Tipo de licencia</span>
                      <strong>{driverOverview?.driverProfile?.licenseType.name}</strong>
                    </article>
                    <article className={styles.infoTile}>
                      <span>Expira</span>
                      <strong>
                        {driverOverview?.driverProfile?.licenseExpiresAt
                          ? new Date(
                              driverOverview.driverProfile.licenseExpiresAt,
                            ).toLocaleDateString('es-EC')
                          : 'No disponible'}
                      </strong>
                    </article>
                    <article className={styles.infoTile}>
                      <span>Enviada</span>
                      <strong>
                        {submittedAt
                          ? new Date(submittedAt).toLocaleString('es-EC')
                          : 'No disponible'}
                      </strong>
                    </article>
                  </div>
                ) : (
                  <div className={styles.emptyPanel}>
                    <strong>Aun no has enviado tu solicitud.</strong>
                    <span>Cuando la completes, aqui veras su estado.</span>
                  </div>
                )}
              </article>

              <article className={`${styles.documentsCard} ${styles.revealSoft}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.kicker}>Documentos</p>
                    <h2>Archivos registrados</h2>
                  </div>
                  <StatusPill
                    label={driverOverview?.driverProfile?.hasRequiredDocuments ? 'Completos' : 'Pendientes'}
                    tone={driverOverview?.driverProfile?.hasRequiredDocuments ? 'success' : 'warning'}
                  />
                </div>

                <div className={styles.documentList}>
                  <article className={styles.documentRow}>
                    <div>
                      <span className={styles.documentRowLabel}>Documento de identidad</span>
                      <strong>{identityFileName ?? 'Sin archivo registrado'}</strong>
                    </div>
                    <div className={styles.documentRowActions}>
                      <Button
                        disabled={!formValues.identityDocumentFileKey || isOpeningIdentityPreview}
                        onClick={() => void handlePreviewDocument('identity')}
                        variant="secondary"
                      >
                        {isOpeningIdentityPreview ? 'Abriendo...' : 'Ver'}
                      </Button>
                      <Button
                        disabled={!formValues.identityDocumentFileKey || isDownloadingIdentityDocument}
                        onClick={() => void handleDownloadDocument('identity')}
                        variant="ghost"
                      >
                        {isDownloadingIdentityDocument ? 'Descargando...' : 'Descargar'}
                      </Button>
                    </div>
                  </article>

                  <article className={styles.documentRow}>
                    <div>
                      <span className={styles.documentRowLabel}>Documento de licencia</span>
                      <strong>{licenseFileName ?? 'Sin archivo registrado'}</strong>
                    </div>
                    <div className={styles.documentRowActions}>
                      <Button
                        disabled={!formValues.licenseDocumentFileKey || isOpeningLicensePreview}
                        onClick={() => void handlePreviewDocument('license')}
                        variant="secondary"
                      >
                        {isOpeningLicensePreview ? 'Abriendo...' : 'Ver'}
                      </Button>
                      <Button
                        disabled={!formValues.licenseDocumentFileKey || isDownloadingLicenseDocument}
                        onClick={() => void handleDownloadDocument('license')}
                        variant="ghost"
                      >
                        {isDownloadingLicenseDocument ? 'Descargando...' : 'Descargar'}
                      </Button>
                    </div>
                  </article>
                </div>
              </article>
            </div>

            <aside className={styles.sideColumn}>
              <article className={`${styles.statusCard} ${styles.reveal}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.kicker}>Estado</p>
                    <h2>Condicion actual</h2>
                  </div>
                  <StatusPill
                    label={licenseAlertMessage ? 'Atencion' : 'Estable'}
                    tone={licenseAlertMessage ? 'warning' : 'success'}
                  />
                </div>

                <div className={styles.noticeStack}>
                  <div className={styles.noticeCard}>
                    <strong>{licenseAlertMessage ? 'Licencia' : 'Cuenta lista'}</strong>
                    <span>
                      {licenseAlertMessage ?? 'Tu estado actual ya esta registrado en la plataforma.'}
                    </span>
                  </div>

                  {reviewNotes ? (
                    <div className={`${styles.noticeCard} ${styles.noticeCardDanger}`}>
                      <strong>Observaciones</strong>
                      <span>{reviewNotes}</span>
                    </div>
                  ) : null}
                </div>
              </article>

              <article className={`${styles.quickCard} ${styles.revealSoft}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.kicker}>Accesos</p>
                    <h2>Siguiente paso</h2>
                  </div>
                  <StatusPill label="Rapido" tone="neutral" />
                </div>

                <div className={styles.quickGrid}>
                  <Link className={styles.quickLink} href="/vehiculos">
                    <strong>Vehiculos</strong>
                    <span>Registra tu vehiculo cuando tu estado lo permita.</span>
                  </Link>
                  <Link className={styles.quickLink} href="/viajes">
                    <strong>Viajes</strong>
                    <span>Gestiona rutas y publicaciones desde tu panel.</span>
                  </Link>
                </div>
              </article>
            </aside>
          </section>
          </div>
        </section>
      )}

      {isApplicationModalOpen ? (
        <div
          aria-labelledby="driver-application-modal-title"
          aria-modal="true"
          className="modal-backdrop"
          onClick={closeApplicationModal}
          role="dialog"
        >
          <div
            className={`modal-card modal-card-lg ${styles.applicationModalCard}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className={styles.kicker}>Solicitud</p>
                <h2 className="panel-title" id="driver-application-modal-title">
                  {hasDriverProfile
                    ? getApplicationActionLabel(currentStatus)
                    : 'Nueva solicitud de conductor'}
                </h2>
                <p className="panel-text">
                  Completa tus datos y carga los documentos requeridos.
                </p>
              </div>
              <Button
                disabled={isSubmitting}
                onClick={closeApplicationModal}
                variant="secondary"
              >
                Cerrar
              </Button>
            </div>

            <form className={`form-stack ${styles.applicationForm}`} onSubmit={handleSubmit}>
              <section className={styles.formSection}>
                <div className={styles.formSectionHeader}>
                  <div>
                    <p className={styles.kicker}>Licencia</p>
                    <h3>Datos principales</h3>
                  </div>
                  <StatusPill
                    label={getDriverStatusLabel(currentStatus)}
                    tone={getDriverStatusTone(currentStatus)}
                  />
                </div>

                <div className={styles.formGrid}>
                  <SelectField
                    label="Tipo de licencia"
                    onChange={(event) => handleFormChange('licenseTypeId', event.target.value)}
                    required
                    value={formValues.licenseTypeId}
                  >
                    <option value="">Selecciona una opcion</option>
                    {licenseTypes.map((licenseType) => (
                      <option key={licenseType.id} value={licenseType.id}>
                        {licenseType.code} - {licenseType.name}
                      </option>
                    ))}
                  </SelectField>

                </div>

                <InputField
                  label="Fecha de expiracion"
                  onChange={(event) => handleFormChange('licenseExpiresAt', event.target.value)}
                  required
                  type="date"
                  value={formValues.licenseExpiresAt}
                />
              </section>

              <section className={styles.formSection}>
                <div className={styles.formSectionHeader}>
                  <div>
                    <p className={styles.kicker}>Documentos</p>
                    <h3>Archivos requeridos</h3>
                  </div>
                  <StatusPill
                    label={validationMessage ? 'Incompleto' : 'Listo'}
                    tone={validationMessage ? 'warning' : 'success'}
                  />
                </div>

                <div className={styles.modalDocumentGrid}>
                  <DocumentCard
                    documentType="identity"
                    fileName={identityFileName}
                    hasFile={Boolean(formValues.identityDocumentFileKey)}
                    isBusy={isUploadingIdentityDocument}
                    isDownloading={isDownloadingIdentityDocument}
                    onDownload={handleDownloadDocument}
                    onFileSelect={handleUploadDocument}
                    onPreview={handlePreviewDocument}
                    onValidationError={(message) =>
                      pushToast('Archivo no valido', message, 'info')
                    }
                  />
                  <DocumentCard
                    documentType="license"
                    fileName={licenseFileName}
                    hasFile={Boolean(formValues.licenseDocumentFileKey)}
                    isBusy={isUploadingLicenseDocument}
                    isDownloading={isDownloadingLicenseDocument}
                    onDownload={handleDownloadDocument}
                    onFileSelect={handleUploadDocument}
                    onPreview={handlePreviewDocument}
                    onValidationError={(message) =>
                      pushToast('Archivo no valido', message, 'info')
                    }
                  />
                </div>
              </section>

              {reviewNotes ? (
                <div className={styles.reviewNoteCard}>
                  <strong>Observaciones</strong>
                  <span>{reviewNotes}</span>
                </div>
              ) : null}

              <div className={styles.modalActions}>
                <Button disabled={isSubmitting} type="submit" variant="primary">
                  {isSubmitting
                    ? 'Enviando...'
                    : hasDriverProfile
                      ? getApplicationActionLabel(currentStatus)
                      : 'Enviar solicitud'}
                </Button>
                <Button
                  disabled={isSubmitting}
                  onClick={closeApplicationModal}
                  type="button"
                  variant="secondary"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <FilePreviewModal
        description={
          previewState?.mimeType?.startsWith('image/')
            ? 'Revisa la imagen antes de continuar.'
            : 'Revisa el archivo antes de descargarlo.'
        }
        fileName={previewState?.fileName ?? null}
        fileUrl={previewState?.fileUrl ?? null}
        isDownloading={
          previewState?.documentType === 'identity'
            ? isDownloadingIdentityDocument
            : previewState?.documentType === 'license'
              ? isDownloadingLicenseDocument
              : false
        }
        isLoading={isOpeningIdentityPreview || isOpeningLicensePreview}
        isOpen={Boolean(previewState)}
        mimeType={previewState?.mimeType ?? null}
        onClose={resetPreviewState}
        onDownload={
          previewState
            ? () => void handleDownloadDocument(previewState.documentType)
            : undefined
        }
        title={previewState?.title ?? 'Documento del conductor'}
      />
    </>
  );
}
