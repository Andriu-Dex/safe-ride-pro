'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { useAuth } from '../../auth/hooks/use-auth';
import { updateCurrentUserProfile } from '../lib/user-api';
import { getOnboardingRequirementLabel } from '../lib/onboarding-labels';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">
            {requiresOnboarding ? 'Completa tu perfil antes de continuar' : 'Gestiona tu perfil'}
          </h1>
          <p className="topbar-subtitle">
            {requiresOnboarding
              ? 'Necesitamos algunos datos base y tus aceptaciones para habilitar el resto del sistema.'
              : 'Mantén actualizada tu informacion personal y tus aceptaciones institucionales.'}
          </p>
        </div>
        <div className="topbar-actions">
          <StatusPill
            label={requiresOnboarding ? 'Onboarding pendiente' : 'Perfil completo'}
            tone={requiresOnboarding ? 'warning' : 'success'}
          />
        </div>
      </header>

      <section className="page-grid-wide">
        <article className="panel panel-stack">
          <div className="panel-header-row">
            <div>
              <p className="section-label">Perfil base</p>
              <h2 className="panel-title">Informacion principal</h2>
            </div>
            <StatusPill label="Editable" tone="neutral" />
          </div>

          <form className="form-stack" onSubmit={handleSubmit}>
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
                hint="Opcional: formato 09XXXXXXXX"
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

            <InputField
              autoComplete="url"
              hint="Opcional: URL publica"
              label="Foto de perfil"
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  profilePhotoUrl: event.target.value,
                }))
              }
              placeholder="https://"
              type="url"
              value={formState.profilePhotoUrl}
            />

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

            {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
            {successMessage ? <div className="form-success">{successMessage}</div> : null}

            <div className="button-row">
              <Button disabled={isSubmitting} type="submit" variant="primary">
                {isSubmitting ? 'Guardando...' : requiresOnboarding ? 'Completar perfil' : 'Guardar cambios'}
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

        <aside className="panel panel-stack compact-helper">
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

          <div className="list-stack">
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
                <StatusPill
                  label={
                    authSession.user.memberships.find((membership) => membership.isDefault)
                      ?.institutionName ?? 'Sin contexto'
                  }
                  tone="neutral"
                />
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
        </aside>
      </section>
    </>
  );
}
