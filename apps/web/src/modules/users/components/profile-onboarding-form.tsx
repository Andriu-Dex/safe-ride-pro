'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { useAuth } from '../../auth/hooks/use-auth';
import { suppressAuthSessionSync } from '../../auth/lib/auth-sync-guard';
import { getUserInitials } from '../lib/get-user-initials';
import { getOnboardingRequirementLabel } from '../lib/onboarding-labels';
import {
  updateCurrentUserProfile,
  uploadCurrentUserProfilePhoto,
} from '../lib/user-api';

type OnboardingFormState = {
  fullName: string;
  career: string;
  phone: string;
  referenceNeighborhood: string;
  profilePhotoUrl: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptSafetyRules: boolean;
};

export function ProfileOnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authSession, refreshSession } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [photoErrorMessage, setPhotoErrorMessage] = useState<string | null>(null);
  const [photoSuccessMessage, setPhotoSuccessMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<OnboardingFormState>({
    fullName: '',
    career: '',
    phone: '',
    referenceNeighborhood: '',
    profilePhotoUrl: '',
    acceptTerms: false,
    acceptPrivacy: false,
    acceptSafetyRules: false,
  });

  useEffect(() => {
    if (!authSession) {
      return;
    }

    setFormState({
      fullName: authSession.user.fullName ?? '',
      career: authSession.user.career ?? '',
      phone: authSession.user.phone ?? '',
      referenceNeighborhood: authSession.user.referenceNeighborhood ?? '',
      profilePhotoUrl: authSession.user.profilePhotoUrl ?? '',
      acceptTerms: Boolean(authSession.user.termsAcceptedAt),
      acceptPrivacy: Boolean(authSession.user.privacyAcceptedAt),
      acceptSafetyRules: Boolean(authSession.user.safetyRulesAcceptedAt),
    });
  }, [authSession]);

  const missingRequirementLabels = useMemo(() => {
    return (authSession?.user.missingOnboardingRequirements ?? []).map(
      getOnboardingRequirementLabel,
    );
  }, [authSession?.user.missingOnboardingRequirements]);

  if (!authSession) {
    return null;
  }

  const requiresOnboarding = authSession.user.requiresOnboarding;
  const nextPath = searchParams.get('next') ?? '/inicio';
  const userInitials = getUserInitials(authSession.user.fullName);
  const activeMembershipName =
    authSession.user.memberships.find((membership) => membership.isDefault)
      ?.institutionName ?? 'Sin contexto';
  const acceptedConsentsCount = [
    authSession.user.termsAcceptedAt,
    authSession.user.privacyAcceptedAt,
    authSession.user.safetyRulesAcceptedAt,
  ].filter(Boolean).length;
  const requiredProfileFieldsCount = [
    formState.fullName.trim(),
    formState.career.trim(),
    formState.referenceNeighborhood.trim(),
  ].filter(Boolean).length;
  const onboardingProgress = Math.round(
    ((6 - missingRequirementLabels.length) / 6) * 100,
  );

  const handleProfilePhotoSelection = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoErrorMessage(null);
    setPhotoSuccessMessage(null);

    try {
      const updatedUser = await uploadCurrentUserProfilePhoto(
        authSession.accessToken,
        selectedFile,
      );

      setFormState((current) => ({
        ...current,
        profilePhotoUrl: updatedUser.profilePhotoUrl ?? '',
      }));
      await refreshSession();
      setPhotoSuccessMessage(
        authSession.user.profilePhotoUrl
          ? 'La foto de perfil se actualizo correctamente.'
          : 'La foto de perfil se subio correctamente.',
      );
    } catch (error) {
      setPhotoErrorMessage(
        error instanceof Error
          ? error.message
          : 'No fue posible subir la foto de perfil.',
      );
    } finally {
      event.target.value = '';
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateCurrentUserProfile(authSession.accessToken, {
        fullName: formState.fullName.trim(),
        career: formState.career.trim(),
        phone: formState.phone.trim() || undefined,
        referenceNeighborhood: formState.referenceNeighborhood.trim(),
        profilePhotoUrl: formState.profilePhotoUrl.trim() || undefined,
        acceptTerms: formState.acceptTerms ? true : undefined,
        acceptPrivacy: formState.acceptPrivacy ? true : undefined,
        acceptSafetyRules: formState.acceptSafetyRules ? true : undefined,
      });

      await refreshSession();
      setSuccessMessage(
        requiresOnboarding
          ? 'Tu perfil base se completo correctamente.'
          : 'Tu perfil se actualizo correctamente.',
      );

      window.setTimeout(() => {
        router.replace(nextPath);
      }, 700);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No fue posible actualizar tu perfil en este momento.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="profile-shell">
      <section className="profile-command">
        <div className="profile-command-copy">
          <p className="section-label">Perfil base</p>
          <h1 className="profile-command-title">
            {requiresOnboarding ? 'Completa tu perfil' : 'Gestion de perfil'}
          </h1>
          <p className="profile-command-subtitle">
            {requiresOnboarding
              ? 'Necesitamos tus datos clave y aceptaciones para habilitar correctamente el resto del sistema.'
              : 'Manten tu informacion personal actualizada para operar sin fricciones.'}
          </p>
        </div>
        <div className="profile-command-actions">
          <StatusPill
            label={requiresOnboarding ? 'Onboarding pendiente' : 'Perfil completo'}
            tone={requiresOnboarding ? 'warning' : 'success'}
          />
          <StatusPill label={`${onboardingProgress}% completo`} tone="neutral" />
        </div>
      </section>

      <section className="profile-kpi-grid">
        <article className="profile-kpi-card">
          <span className="profile-kpi-label">Datos requeridos</span>
          <strong className="profile-kpi-value">{requiredProfileFieldsCount}/3</strong>
          <p className="profile-kpi-note">Nombre, carrera y zona de referencia.</p>
        </article>
        <article className="profile-kpi-card">
          <span className="profile-kpi-label">Aceptaciones</span>
          <strong className="profile-kpi-value">{acceptedConsentsCount}/3</strong>
          <p className="profile-kpi-note">Terminos, privacidad y seguridad.</p>
        </article>
        <article className="profile-kpi-card">
          <span className="profile-kpi-label">Pendientes</span>
          <strong className="profile-kpi-value">{missingRequirementLabels.length}</strong>
          <p className="profile-kpi-note">Puntos por completar para habilitar cuenta.</p>
        </article>
        <article className="profile-kpi-card">
          <span className="profile-kpi-label">Institucion activa</span>
          <strong className="profile-kpi-value">{activeMembershipName}</strong>
          <p className="profile-kpi-note">Contexto operativo de esta sesion.</p>
        </article>
      </section>

      <section className="profile-main-grid">
        <article className="panel panel-stack profile-form-panel">
          <div className="panel-header-row">
            <div>
              <p className="section-label">Perfil base</p>
              <h2 className="panel-title">Informacion principal</h2>
            </div>
            <StatusPill label="Editable" tone="neutral" />
          </div>

          <section className="profile-photo-card">
            <div className="profile-photo-preview">
              {formState.profilePhotoUrl ? (
                <img
                  alt="Foto de perfil actual"
                  className="profile-photo-image"
                  src={formState.profilePhotoUrl}
                />
              ) : (
                <div className="profile-photo-fallback" aria-hidden="true">
                  {userInitials}
                </div>
              )}
            </div>
            <div className="profile-photo-content">
              <strong>Foto de perfil</strong>
              <p className="panel-text">
                Sube una imagen JPG, PNG o WEBP. SafeRidePro almacenara un enlace
                publico de tu avatar para mostrarlo en la plataforma.
              </p>
              <div className="button-row">
                <input
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onClick={() => suppressAuthSessionSync()}
                  onChange={handleProfilePhotoSelection}
                  type="file"
                />
                <Button
                  disabled={isUploadingPhoto}
                  onClick={() => {
                    suppressAuthSessionSync();
                    fileInputRef.current?.click();
                  }}
                  variant="secondary"
                >
                  {isUploadingPhoto
                    ? 'Subiendo imagen...'
                    : formState.profilePhotoUrl
                      ? 'Cambiar imagen'
                      : 'Subir imagen'}
                </Button>
              </div>
              {photoErrorMessage ? <div className="form-error">{photoErrorMessage}</div> : null}
              {photoSuccessMessage ? (
                <div className="form-success">{photoSuccessMessage}</div>
              ) : null}
            </div>
          </section>

          <form className="form-stack" onSubmit={handleSubmit}>
            <section className="profile-form-section">
              <div className="profile-form-section-header">
                <div>
                  <p className="section-label">Datos personales</p>
                  <h3 className="panel-title">Informacion de contacto y contexto</h3>
                </div>
                <p className="section-heading-meta">
                  Completa solo los datos base que el sistema necesita para operar.
                </p>
              </div>

              <InputField
                autoComplete="name"
                label="Nombre completo"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                required
                value={formState.fullName}
              />

              <div className="form-grid form-grid-2">
                <InputField
                  label="Carrera"
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      career: event.target.value,
                    }))
                  }
                  placeholder="Ej. Ingenieria en Software"
                  required
                  value={formState.career}
                />
                <InputField
                  autoComplete="tel"
                  label="Celular"
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="0999999999"
                  value={formState.phone}
                />
              </div>

              <InputField
                label="Zona o barrio de referencia"
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    referenceNeighborhood: event.target.value,
                  }))
                }
                placeholder="Ej. Ficoa, Huachi Chico, Izamba"
                required
                value={formState.referenceNeighborhood}
              />
            </section>

            <section className="profile-form-section">
              <div className="profile-form-section-header">
                <div>
                  <p className="section-label">Aceptaciones</p>
                  <h3 className="panel-title">Compromisos institucionales</h3>
                </div>
                <p className="section-heading-meta">
                  Debes aceptar estas condiciones una sola vez para habilitar el sistema.
                </p>
              </div>

              <div className="consent-grid">
                <label className="consent-card">
                  <input
                    checked={formState.acceptTerms}
                    className="consent-checkbox"
                    disabled={Boolean(authSession.user.termsAcceptedAt)}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        acceptTerms: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <div>
                    <strong>Acepto los terminos del servicio</strong>
                    <p>Necesario para usar SafeRidePro dentro de tu institucion.</p>
                  </div>
                </label>

                <label className="consent-card">
                  <input
                    checked={formState.acceptPrivacy}
                    className="consent-checkbox"
                    disabled={Boolean(authSession.user.privacyAcceptedAt)}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        acceptPrivacy: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <div>
                    <strong>Acepto la politica de privacidad</strong>
                    <p>Tu informacion se usara solo para la operacion institucional del sistema.</p>
                  </div>
                </label>

                <label className="consent-card">
                  <input
                    checked={formState.acceptSafetyRules}
                    className="consent-checkbox"
                    disabled={Boolean(authSession.user.safetyRulesAcceptedAt)}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        acceptSafetyRules: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <div>
                    <strong>Acepto las reglas de seguridad</strong>
                    <p>Incluyen puntualidad, respeto, uso responsable y convivencia segura.</p>
                  </div>
                </label>
              </div>
            </section>

            {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
            {successMessage ? <div className="form-success">{successMessage}</div> : null}

            <div className="button-row profile-form-actions">
              <Button disabled={isSubmitting} type="submit" variant="primary">
                {isSubmitting
                  ? 'Guardando...'
                  : requiresOnboarding
                    ? 'Completar perfil'
                    : 'Guardar cambios'}
              </Button>
              {!requiresOnboarding ? (
                <Button
                  disabled={isSubmitting}
                  onClick={() => router.replace('/inicio')}
                  variant="secondary"
                >
                  Volver a inicio
                </Button>
              ) : null}
            </div>
          </form>
        </article>

        <aside className="profile-side-stack">
          <article className="profile-checklist-card">
            <div className="panel-header-row">
              <div>
                <p className="section-label">Checklist</p>
                <h2 className="panel-title">Estado del onboarding</h2>
              </div>
              <StatusPill
                label={requiresOnboarding ? 'Pendiente' : 'Completado'}
                tone={requiresOnboarding ? 'warning' : 'success'}
              />
            </div>

            {missingRequirementLabels.length ? (
              <div className="validation-card validation-card-warning">
                <strong>Faltan estos puntos para habilitar tu cuenta:</strong>
                <ul className="validation-list">
                  {missingRequirementLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="form-success">
                Tu perfil ya cumple el onboarding minimo y puedes seguir operando con normalidad.
              </div>
            )}

            <div className="list-stack profile-aside-stack">
              <div className="list-card">
                <div className="list-card-header">
                  <strong>Correo</strong>
                  <StatusPill
                    label={authSession.user.emailVerifiedAt ? 'Verificado' : 'Pendiente'}
                    tone={authSession.user.emailVerifiedAt ? 'success' : 'warning'}
                  />
                </div>
                <p className="panel-text">{authSession.user.email}</p>
              </div>

              <div className="list-card">
                <div className="list-card-header">
                  <strong>Institucion activa</strong>
                  <StatusPill label={activeMembershipName} tone="neutral" />
                </div>
                <p className="panel-text">
                  El perfil base se completa una sola vez y luego puedes editarlo desde esta misma vista.
                </p>
              </div>

              <div className="list-card list-card-strong">
                <strong>Siguiente paso</strong>
                <p className="panel-text">
                  Cuando termines este bloque, ya podremos continuar correctamente con el flujo de
                  conductor, vehiculos y viajes.
                </p>
              </div>
            </div>
          </article>

          <article className="profile-quick-card">
            <div className="profile-quick-head">
              <h2 className="panel-title">Continuidad operativa</h2>
              <StatusPill label="Acciones" tone="neutral" />
            </div>

            <div className="profile-quick-grid">
              <Link className="profile-quick-link" href="/conductor">
                <strong>Conductor</strong>
                <span>Valida tu estado y documentacion para operar.</span>
              </Link>
              <Link className="profile-quick-link" href="/vehiculos">
                <strong>Vehiculos</strong>
                <span>Registra y activa tu flota antes de publicar.</span>
              </Link>
              <Link className="profile-quick-link" href="/viajes">
                <strong>Viajes</strong>
                <span>Gestiona solicitudes y trayectos de forma diaria.</span>
              </Link>
            </div>
          </article>
        </aside>
      </section>
    </section>
  );
}
