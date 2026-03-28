'use client';

import { DriverVerificationStatus } from '@saferidepro/shared-types';
import { useEffect, useState } from 'react';

import { InfoCard } from '../../../components/ui/info-card';
import { StatusPill } from '../../../components/ui/status-pill';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { DriverApplicationForm } from '../../../modules/driver/components/driver-application-form';
import { getDriverOverview, listDriverLicenseTypes, submitDriverApplication } from '../../../modules/driver/lib/driver-api';
import { getDriverStatusLabel, getDriverStatusTone } from '../../../modules/driver/lib/driver-status';
import type { DriverOverview, LicenseTypeCatalogItem } from '../../../modules/driver/types/driver';
import { ApiError } from '../../../lib/api-client';

const EMPTY_FORM = {
  licenseTypeId: '',
  licenseNumber: '',
  licenseExpiresAt: '',
  identityDocumentFileKey: '',
  licenseDocumentFileKey: '',
};

function toDateInputValue(isoDate?: string | null): string {
  if (!isoDate) {
    return '';
  }

  return isoDate.slice(0, 10);
}

export default function DriverPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const [driverOverview, setDriverOverview] = useState<DriverOverview | null>(null);
  const [licenseTypes, setLicenseTypes] = useState<LicenseTypeCatalogItem[]>([]);
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated || !authSession) {
      return;
    }

    let isMounted = true;

    const loadDriverData = async () => {
      setIsLoading(true);
      setErrorMessage(null);

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
      } catch (error) {
        if (!isMounted) {
          return;
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
  }, [authSession, isHydrated]);

  const handleFormChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
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
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible enviar la solicitud de conductor.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStatus = driverOverview?.membership?.driverVerificationStatus ?? DriverVerificationStatus.NotRequested;

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Conductor</h1>
          <p className="topbar-subtitle">
            Gestiona tu habilitacion como conductor institucional antes de registrar vehiculos y publicar viajes.
          </p>
        </div>
        <StatusPill label={getDriverStatusLabel(currentStatus)} tone={getDriverStatusTone(currentStatus)} />
      </header>

      {isLoading ? (
        <section className="loading-state compact-loading-state">
          <div className="loading-card">
            <div aria-hidden="true" className="loading-pulse" />
            <h2 className="panel-title">Cargando estado de conductor</h2>
            <p className="panel-text">Estamos consultando tu informacion institucional y tu solicitud actual.</p>
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
              description="Cuando exista una revision administrativa, aparecera aqui y dentro del detalle de la solicitud."
              label="Ultima revision"
              value={driverOverview?.driverProfile?.reviewedAt ? 'Registrada' : 'Pendiente'}
            />
          </div>

          <div className="page-grid page-grid-wide">
            <DriverApplicationForm
              currentReviewNotes={driverOverview?.driverProfile?.reviewNotes}
              currentStatus={currentStatus}
              errorMessage={errorMessage}
              isSubmitting={isSubmitting}
              licenseTypes={licenseTypes}
              onChange={handleFormChange}
              onSubmit={handleSubmit}
              successMessage={successMessage}
              values={formValues}
            />

            <article className="panel panel-stack">
              <h2 className="panel-title">Resumen de la solicitud</h2>
              {driverOverview?.driverProfile ? (
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
                    <dd>{new Date(driverOverview.driverProfile.licenseExpiresAt).toLocaleDateString('es-EC')}</dd>
                  </div>
                  <div>
                    <dt>Enviada el</dt>
                    <dd>{new Date(driverOverview.driverProfile.submittedAt).toLocaleString('es-EC')}</dd>
                  </div>
                </dl>
              ) : (
                <p className="panel-text">
                  Aun no has enviado una solicitud. Completa el formulario para activar tu proceso de conductor.
                </p>
              )}
            </article>
          </div>
        </section>
      )}
    </>
  );
}

