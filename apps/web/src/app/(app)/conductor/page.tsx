'use client';

import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  InstitutionMembershipRole,
} from '@saferidepro/shared-types';
import { useEffect, useState } from 'react';

import { FilePreviewModal } from '../../../components/ui/file-preview-modal';
import { InfoCard } from '../../../components/ui/info-card';
import { OperationalAccessCard } from '../../../components/ui/operational-access-card';
import { StatusPill } from '../../../components/ui/status-pill';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../modules/auth/lib/operational-context';
import { DriverApplicationForm } from '../../../modules/driver/components/driver-application-form';
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
import { downloadBlobFile } from '../../../lib/blob-file';
import { ApiError } from '../../../lib/api-client';

const EMPTY_FORM = {
  licenseTypeId: '',
  licenseNumber: '',
  licenseExpiresAt: '',
  identityDocumentFileKey: '',
  licenseDocumentFileKey: '',
};

type DocumentPreviewState = {
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

export default function DriverPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const [driverOverview, setDriverOverview] = useState<DriverOverview | null>(null);
  const [licenseTypes, setLicenseTypes] = useState<LicenseTypeCatalogItem[]>([]);
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingIdentityDocument, setIsUploadingIdentityDocument] = useState(false);
  const [isUploadingLicenseDocument, setIsUploadingLicenseDocument] = useState(false);
  const [isOpeningIdentityPreview, setIsOpeningIdentityPreview] = useState(false);
  const [isOpeningLicensePreview, setIsOpeningLicensePreview] = useState(false);
  const [isDownloadingIdentityDocument, setIsDownloadingIdentityDocument] = useState(false);
  const [isDownloadingLicenseDocument, setIsDownloadingLicenseDocument] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [documentErrorMessage, setDocumentErrorMessage] = useState<string | null>(null);
  const [documentSuccessMessage, setDocumentSuccessMessage] = useState<string | null>(null);
  const [identityDocumentFileName, setIdentityDocumentFileName] = useState<string | null>(null);
  const [licenseDocumentFileName, setLicenseDocumentFileName] = useState<string | null>(null);
  const [identityDocumentPreviewUrl, setIdentityDocumentPreviewUrl] = useState<string | null>(null);
  const [licenseDocumentPreviewUrl, setLicenseDocumentPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<DocumentPreviewState | null>(null);
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(null);

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
      setErrorMessage(null);
      setDocumentErrorMessage(null);
      setDocumentSuccessMessage(null);

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
        setFormValues({
          licenseTypeId: overview.driverProfile?.licenseType.id ?? '',
          licenseNumber: overview.driverProfile?.licenseNumber ?? '',
          licenseExpiresAt: toDateInputValue(overview.driverProfile?.licenseExpiresAt),
          identityDocumentFileKey: overview.driverProfile?.identityDocumentFileKey ?? '',
          licenseDocumentFileKey: overview.driverProfile?.licenseDocumentFileKey ?? '',
        });
        setIdentityDocumentFileName(
          extractUploadedFileName(overview.driverProfile?.identityDocumentFileKey),
        );
        setLicenseDocumentFileName(
          extractUploadedFileName(overview.driverProfile?.licenseDocumentFileKey),
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        if (error instanceof ApiError) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('No fue posible cargar el estado de conductor.');
        }
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
      if (identityDocumentPreviewUrl) {
        URL.revokeObjectURL(identityDocumentPreviewUrl);
      }

      if (licenseDocumentPreviewUrl) {
        URL.revokeObjectURL(licenseDocumentPreviewUrl);
      }

      if (previewState?.fileUrl) {
        URL.revokeObjectURL(previewState.fileUrl);
      }
    };
  }, [identityDocumentPreviewUrl, licenseDocumentPreviewUrl, previewState]);

  const handleFormChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

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

  const resetPreviewState = () => {
    setPreviewErrorMessage(null);
    setPreviewState((currentPreview) => {
      if (currentPreview?.fileUrl) {
        URL.revokeObjectURL(currentPreview.fileUrl);
      }

      return null;
    });
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

    setDocumentErrorMessage(null);
    setDocumentSuccessMessage(null);

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
        setIdentityDocumentFileName(file.name);
        if (file.type.startsWith('image/')) {
          setIdentityDocumentPreviewUrl((currentPreviewUrl) => {
            if (currentPreviewUrl) {
              URL.revokeObjectURL(currentPreviewUrl);
            }

            return URL.createObjectURL(file);
          });
        } else {
          setIdentityDocumentPreviewUrl((currentPreviewUrl) => {
            if (currentPreviewUrl) {
              URL.revokeObjectURL(currentPreviewUrl);
            }

            return null;
          });
        }
      } else {
        setLicenseDocumentFileName(file.name);
        if (file.type.startsWith('image/')) {
          setLicenseDocumentPreviewUrl((currentPreviewUrl) => {
            if (currentPreviewUrl) {
              URL.revokeObjectURL(currentPreviewUrl);
            }

            return URL.createObjectURL(file);
          });
        } else {
          setLicenseDocumentPreviewUrl((currentPreviewUrl) => {
            if (currentPreviewUrl) {
              URL.revokeObjectURL(currentPreviewUrl);
            }

            return null;
          });
        }
      }

      setDocumentSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setDocumentErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'No fue posible cargar el documento del conductor.',
      );
    } finally {
      if (documentType === 'identity') {
        setIsUploadingIdentityDocument(false);
      } else {
        setIsUploadingLicenseDocument(false);
      }
    }
  };

  const handleDocumentValidationError = (message: string) => {
    setDocumentSuccessMessage(null);
    setDocumentErrorMessage(message);
  };

  const fetchDriverDocumentBlob = async (
    documentType: DriverDocumentType,
  ): Promise<{ blob: Blob; fileName: string }> => {
    if (!authSession || !currentMembershipId) {
      throw new ApiError('No fue posible identificar la solicitud de conductor actual.', 400);
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

  const handlePreviewDocument = async (documentType: DriverDocumentType) => {
    if (documentType === 'identity') {
      setIsOpeningIdentityPreview(true);
    } else {
      setIsOpeningLicensePreview(true);
    }

    setPreviewErrorMessage(null);

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
      setPreviewErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'No fue posible abrir la previsualizacion del documento.',
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

    setDocumentErrorMessage(null);

    try {
      const { blob, fileName } = await fetchDriverDocumentBlob(documentType);
      downloadBlobFile(blob, fileName);
    } catch (error) {
      setDocumentErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'No fue posible descargar el documento del conductor.',
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

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setDocumentErrorMessage(null);

    try {
      const response = await submitDriverApplication(authSession.accessToken, {
        licenseTypeId: formValues.licenseTypeId,
        licenseNumber: formValues.licenseNumber,
        licenseExpiresAt: formValues.licenseExpiresAt,
        identityDocumentFileKey: formValues.identityDocumentFileKey || undefined,
        licenseDocumentFileKey: formValues.licenseDocumentFileKey || undefined,
      });

      const overview = await getDriverOverview(authSession.accessToken);
      setDriverOverview(overview);
      setSuccessMessage(response.message);
      await refreshSession();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible enviar la solicitud de conductor.');
      }
    } finally {
      setIsSubmitting(false);
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
        <header className="topbar">
          <div>
            <h1 className="topbar-title">Conductor</h1>
            <p className="topbar-subtitle">
              Gestiona tu habilitacion como conductor institucional antes de registrar
              vehiculos y publicar viajes.
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

  if (!isLoading && isAdministrativeMembership) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="topbar-title">Conductor</h1>
            <p className="topbar-subtitle">
              La habilitacion como conductor esta reservada para membresias operativas
              no administrativas.
            </p>
          </div>
          <StatusPill label="No disponible" tone="warning" />
        </header>

        <section className="empty-state">
          <div className="empty-state-card">
            <h2 className="panel-title">Membresia administrativa detectada</h2>
            <p className="empty-state-text">
              Una membresia con rol administrativo institucional no debe operar como
              conductor para evitar conflictos de revision y permisos. Si necesitas
              usar este flujo, accede con una membresia de estudiante activa.
            </p>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Conductor</h1>
          <p className="topbar-subtitle">
            Gestiona tu habilitacion como conductor institucional antes de registrar
            vehiculos y publicar viajes.
          </p>
        </div>
        <StatusPill
          label={getDriverStatusLabel(currentStatus)}
          tone={getDriverStatusTone(currentStatus)}
        />
      </header>

      {isLoading ? (
        <section className="loading-state compact-loading-state">
          <div className="loading-card">
            <div aria-hidden="true" className="loading-pulse" />
            <h2 className="panel-title">Cargando estado de conductor</h2>
            <p className="panel-text">
              Estamos consultando tu informacion institucional y tu solicitud actual.
            </p>
          </div>
        </section>
      ) : (
        <section className="content-grid">
          <div className="metrics-grid">
            <InfoCard
              description="La solicitud se asocia a tu membresia institucional activa."
              label="Institucion"
              value={driverOverview?.membership?.institutionName ?? 'No disponible'}
            />
            <InfoCard
              description="Este estado controla si puedes registrar vehiculos y crear viajes."
              label="Estado del conductor"
              value={getDriverStatusLabel(currentStatus)}
            />
            <InfoCard
              description="La vigencia de la licencia afecta automaticamente el acceso a vehiculos y viajes."
              label="Vigencia"
              value={getDriverLicenseStatusLabel(licenseStatus)}
            />
          </div>

          {licenseAlertMessage ? <div className="form-helper">{licenseAlertMessage}</div> : null}

          {driverOverview?.driverProfile && !driverOverview.driverProfile.hasRequiredDocuments ? (
            <div className="form-helper">
              Para aprobar la solicitud debes contar con clave del documento de identidad
              y clave del documento de licencia.
            </div>
          ) : null}

          <div className="page-grid page-grid-wide">
            <DriverApplicationForm
              currentReviewNotes={driverOverview?.driverProfile?.reviewNotes}
              currentStatus={currentStatus}
              documentErrorMessage={documentErrorMessage}
              documentSuccessMessage={documentSuccessMessage}
              errorMessage={errorMessage}
              identityDocumentFileName={identityDocumentFileName}
              identityDocumentPreviewUrl={identityDocumentPreviewUrl}
              isDownloadingIdentityDocument={isDownloadingIdentityDocument}
              isDownloadingLicenseDocument={isDownloadingLicenseDocument}
              isOpeningIdentityPreview={isOpeningIdentityPreview}
              isOpeningLicensePreview={isOpeningLicensePreview}
              isSubmitting={isSubmitting}
              isUploadingIdentityDocument={isUploadingIdentityDocument}
              isUploadingLicenseDocument={isUploadingLicenseDocument}
              licenseDocumentFileName={licenseDocumentFileName}
              licenseDocumentPreviewUrl={licenseDocumentPreviewUrl}
              licenseTypes={licenseTypes}
              onChange={handleFormChange}
              onDocumentValidationError={handleDocumentValidationError}
              onDownloadDocument={handleDownloadDocument}
              onPreviewDocument={handlePreviewDocument}
              onSubmit={handleSubmit}
              onUploadDocument={handleUploadDocument}
              successMessage={successMessage}
              values={formValues}
            />

            <article className="panel panel-stack">
              <h2 className="panel-title">Resumen de la solicitud</h2>
              {driverOverview?.driverProfile ? (
                <>
                  <div className="panel-header-row">
                    <h3 className="panel-title panel-title-sm">Estado documental</h3>
                    <StatusPill
                      label={getDriverLicenseStatusLabel(
                        driverOverview.driverProfile.licenseStatus,
                      )}
                      tone={getDriverLicenseStatusTone(
                        driverOverview.driverProfile.licenseStatus,
                      )}
                    />
                  </div>
                  <dl className="detail-list">
                    <div>
                      <dt>Tipo de licencia</dt>
                      <dd>{driverOverview.driverProfile.licenseType.name}</dd>
                    </div>
                    <div>
                      <dt>Numero de licencia</dt>
                      <dd>{driverOverview.driverProfile.licenseNumber}</dd>
                    </div>
                    <div>
                      <dt>Expira el</dt>
                      <dd>
                        {new Date(
                          driverOverview.driverProfile.licenseExpiresAt,
                        ).toLocaleDateString('es-EC')}
                      </dd>
                    </div>
                    <div>
                      <dt>Enviada el</dt>
                      <dd>
                        {new Date(
                          driverOverview.driverProfile.submittedAt,
                        ).toLocaleString('es-EC')}
                      </dd>
                    </div>
                    <div>
                      <dt>Documento de identidad</dt>
                      <dd>
                        {driverOverview.driverProfile.identityDocumentFileKey
                          ? 'Registrado'
                          : 'Pendiente'}
                      </dd>
                    </div>
                    <div>
                      <dt>Documento de licencia</dt>
                      <dd>
                        {driverOverview.driverProfile.licenseDocumentFileKey
                          ? 'Registrado'
                          : 'Pendiente'}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="panel-text">
                  Aun no has enviado una solicitud. Completa el formulario para activar
                  tu proceso de conductor.
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
            : 'Revisa el documento antes de descargarlo o continuar con tu proceso.'
        }
        errorMessage={previewErrorMessage}
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
        isOpen={Boolean(previewState) || Boolean(previewErrorMessage)}
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
