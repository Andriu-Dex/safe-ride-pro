'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { useAuth } from '../../auth/hooks/use-auth';
import { suppressAuthSessionSync } from '../../auth/lib/auth-sync-guard';
import { getOnboardingRequirementLabel } from '../lib/onboarding-labels';
import { getUserInitials } from '../lib/get-user-initials';
import {
  updateCurrentUserProfile,
  uploadCurrentUserProfilePhoto,
} from '../lib/user-api';
import styles from './profile-onboarding-form.module.css';

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
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [saveHighlightVisible, setSaveHighlightVisible] = useState(false);
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

  const syncFormStateFromSession = (session: NonNullable<typeof authSession>) => {
    setFormState({
      fullName: session.user.fullName ?? '',
      career: session.user.career ?? '',
      phone: session.user.phone ?? '',
      referenceNeighborhood: session.user.referenceNeighborhood ?? '',
      profilePhotoUrl: session.user.profilePhotoUrl ?? '',
      acceptTerms: Boolean(session.user.termsAcceptedAt),
      acceptPrivacy: Boolean(session.user.privacyAcceptedAt),
      acceptSafetyRules: Boolean(session.user.safetyRulesAcceptedAt),
    });
  };

  useEffect(() => {
    if (!authSession) {
      return;
    }

    syncFormStateFromSession(authSession);
  }, [authSession]);

  const missingRequirementLabels = useMemo(() => {
    return (authSession?.user.missingOnboardingRequirements ?? []).map(
      getOnboardingRequirementLabel,
    );
  }, [authSession?.user.missingOnboardingRequirements]);

  useEffect(() => {
    if (!avatarPreviewUrl) {
      return;
    }

    return () => {
      URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

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
  const pendingConsentCount = [
    !authSession.user.termsAcceptedAt,
    !authSession.user.privacyAcceptedAt,
    !authSession.user.safetyRulesAcceptedAt,
  ].filter(Boolean).length;
  const requiredProfileFieldsCount = [
    formState.fullName.trim(),
    formState.career.trim(),
    formState.referenceNeighborhood.trim(),
  ].filter(Boolean).length;
  const onboardingProgress = Math.round(
    ((6 - missingRequirementLabels.length) / 6) * 100,
  );

  const pushToast = (
    title: string,
    description: string,
    tone: ToastItem['tone'] = 'error',
  ) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `profile-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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

  const closeAvatarModal = () => {
    setIsAvatarModalOpen(false);
    setSelectedAvatarFile(null);
    setAvatarPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return null;
    });
  };

  const openEditModal = () => {
    syncFormStateFromSession(authSession);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    syncFormStateFromSession(authSession);
  };

  const areAllEditableConsentsChecked =
    (Boolean(authSession.user.termsAcceptedAt) || formState.acceptTerms) &&
    (Boolean(authSession.user.privacyAcceptedAt) || formState.acceptPrivacy) &&
    (Boolean(authSession.user.safetyRulesAcceptedAt) || formState.acceptSafetyRules);

  const handleSelectAllConsents = () => {
    setFormState((current) => ({
      ...current,
      acceptTerms: authSession.user.termsAcceptedAt ? current.acceptTerms : true,
      acceptPrivacy: authSession.user.privacyAcceptedAt ? current.acceptPrivacy : true,
      acceptSafetyRules: authSession.user.safetyRulesAcceptedAt
        ? current.acceptSafetyRules
        : true,
    }));

    pushToast(
      'Consentimientos listos',
      'Se marcaron todas las opciones disponibles.',
      'success',
    );
  };

  const handleAvatarFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    setAvatarPreviewUrl((currentPreviewUrl) => {
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl);
      }

      return URL.createObjectURL(selectedFile);
    });
    setSelectedAvatarFile(selectedFile);
    event.target.value = '';
  };

  const handleProfilePhotoUpload = async () => {
    if (!selectedAvatarFile) {
      pushToast(
        'Selecciona una imagen',
        'Elige una foto antes de confirmar el cambio de avatar.',
        'info',
      );
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const updatedUser = await uploadCurrentUserProfilePhoto(
        authSession.accessToken,
        selectedAvatarFile,
      );

      setFormState((current) => ({
        ...current,
        profilePhotoUrl: updatedUser.profilePhotoUrl ?? '',
      }));
      await refreshSession();
      closeAvatarModal();
      pushToast(
        authSession.user.profilePhotoUrl ? 'Foto actualizada' : 'Foto subida',
        authSession.user.profilePhotoUrl
          ? 'La foto de perfil se actualizo correctamente.'
          : 'La foto de perfil se subio correctamente.',
        'success',
      );
    } catch (error) {
      pushToast(
        'Error al subir foto',
        error instanceof Error
          ? error.message
          : 'No fue posible subir la foto de perfil.',
        'error',
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

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
      setIsEditModalOpen(false);
      pushToast(
        requiresOnboarding ? 'Perfil completado' : 'Perfil actualizado',
        requiresOnboarding
          ? 'Tu perfil base se completo correctamente.'
          : 'Tu perfil se actualizo correctamente.',
        'success',
      );
      setSaveHighlightVisible(true);
      window.setTimeout(() => {
        setSaveHighlightVisible(false);
      }, 2600);

      if (requiresOnboarding) {
        window.setTimeout(() => {
          router.replace(nextPath);
        }, 700);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No fue posible actualizar tu perfil en este momento.';
      pushToast('No se pudo guardar', message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <section className={styles.profileShell}>
        <section
          className={[
            styles.hero,
            styles.reveal,
            saveHighlightVisible ? styles.heroSaved : '',
          ].join(' ')}
        >
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Perfil institucional</p>
              <h1 className={styles.heroTitle}>
                {requiresOnboarding ? 'Completa tu perfil' : 'Tu perfil'}
              </h1>
              <p className={styles.heroLead}>
                Manten tus datos y permisos al dia.
              </p>
            </div>

            <div className={styles.heroStatus}>
              <StatusPill
                label={requiresOnboarding ? 'Onboarding pendiente' : 'Perfil completo'}
                tone={requiresOnboarding ? 'warning' : 'success'}
              />
              <StatusPill label={`${onboardingProgress}% completo`} tone="neutral" />
            </div>
          </div>

          <div className={styles.statGrid}>
            <article className={`${styles.statCard} ${styles.revealSoft}`}>
              <span className={styles.statLabel}>Campos base</span>
              <strong className={styles.statValue}>{requiredProfileFieldsCount}/3</strong>
              <span className={styles.statNote}>Nombre, carrera y zona.</span>
            </article>
            <article className={`${styles.statCard} ${styles.revealSoft}`}>
              <span className={styles.statLabel}>Aceptaciones</span>
              <strong className={styles.statValue}>{acceptedConsentsCount}/3</strong>
              <span className={styles.statNote}>Terminos, privacidad y seguridad.</span>
            </article>
            <article className={`${styles.statCard} ${styles.revealSoft}`}>
              <span className={styles.statLabel}>Consentimientos</span>
              <strong className={styles.statValue}>{pendingConsentCount}</strong>
              <span className={styles.statNote}>Opciones pendientes.</span>
            </article>
            <article className={`${styles.statCard} ${styles.revealSoft}`}>
              <span className={styles.statLabel}>Pendientes</span>
              <strong className={styles.statValue}>{missingRequirementLabels.length}</strong>
              <span className={styles.statNote}>Elementos por completar.</span>
            </article>
          </div>

          {saveHighlightVisible ? (
            <div className={styles.saveBanner}>
              <strong>Cambios guardados</strong>
              <span>Tu perfil se actualizo correctamente.</span>
            </div>
          ) : null}
        </section>

        <section className={styles.mainGrid}>
          <div className={styles.formPanel}>
            <article className={`${styles.identityCard} ${styles.reveal}`}>
              <div className={styles.avatarWrap}>
                <div className={styles.avatarFrame} aria-hidden="true">
                  {formState.profilePhotoUrl ? (
                    <img
                      alt="Foto de perfil actual"
                      className={styles.avatarImage}
                      src={formState.profilePhotoUrl}
                    />
                  ) : (
                    <div className={styles.avatarFallback}>{userInitials}</div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  className={styles.srOnly}
                  onChange={handleAvatarFileSelection}
                  onClick={() => suppressAuthSessionSync()}
                  type="file"
                />

                <Button
                  className={styles.photoButton}
                  onClick={() => {
                    setIsAvatarModalOpen(true);
                  }}
                  variant="secondary"
                >
                  {formState.profilePhotoUrl ? 'Cambiar imagen' : 'Subir imagen'}
                </Button>
              </div>

              <div className={styles.identityBody}>
                <div className={styles.identityHeader}>
                  <div className={styles.identityMeta}>
                    <p className={styles.kicker}>Identidad visible</p>
                    <h2>{authSession.user.fullName}</h2>
                    <p>{authSession.user.email}</p>
                  </div>
                  <StatusPill
                    label={authSession.user.emailVerifiedAt ? 'Correo verificado' : 'Correo pendiente'}
                    tone={authSession.user.emailVerifiedAt ? 'success' : 'warning'}
                  />
                </div>

                <div className={styles.identityHighlights}>
                  <article className={styles.highlight}>
                    <span>Institucion</span>
                    <strong>{activeMembershipName}</strong>
                  </article>
                  <article className={styles.highlight}>
                    <span>Carrera</span>
                    <strong>{formState.career.trim() || 'Por completar'}</strong>
                  </article>
                  <article className={styles.highlight}>
                    <span>Zona base</span>
                    <strong>{formState.referenceNeighborhood.trim() || 'Por completar'}</strong>
                  </article>
                </div>

                <div className={styles.identityActions}>
                  <Button onClick={openEditModal} variant="primary">
                    {requiresOnboarding ? 'Completar perfil' : 'Editar perfil'}
                  </Button>
                  {!requiresOnboarding ? (
                    <Button
                      onClick={() => router.replace('/inicio')}
                      variant="secondary"
                    >
                      Volver a inicio
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>

            <section className={styles.overviewGrid}>
              <article className={`${styles.overviewCard} ${styles.revealSoft}`}>
                <div className={styles.sectionHeaderCompact}>
                  <div>
                    <p className={styles.kicker}>Resumen</p>
                    <h3>Datos actuales</h3>
                  </div>
                  <StatusPill label="Lectura" tone="neutral" />
                </div>

                <div className={styles.infoGrid}>
                  <article className={styles.infoTile}>
                    <span>Nombre</span>
                    <strong>{formState.fullName.trim() || 'Por completar'}</strong>
                  </article>
                  <article className={styles.infoTile}>
                    <span>Celular</span>
                    <strong>{formState.phone.trim() || 'No registrado'}</strong>
                  </article>
                  <article className={styles.infoTile}>
                    <span>Carrera</span>
                    <strong>{formState.career.trim() || 'Por completar'}</strong>
                  </article>
                  <article className={styles.infoTile}>
                    <span>Zona</span>
                    <strong>{formState.referenceNeighborhood.trim() || 'Por completar'}</strong>
                  </article>
                </div>
              </article>

              <article className={`${styles.overviewCard} ${styles.revealSoft}`}>
                <div className={styles.sectionHeaderCompact}>
                  <div>
                    <p className={styles.kicker}>Cuenta</p>
                    <h3>Estado general</h3>
                  </div>
                  <StatusPill
                    label={requiresOnboarding ? 'Pendiente' : 'Activa'}
                    tone={requiresOnboarding ? 'warning' : 'success'}
                  />
                </div>

                <div className={styles.infoGrid}>
                  <article className={styles.infoTile}>
                    <span>Institucion</span>
                    <strong>{activeMembershipName}</strong>
                  </article>
                  <article className={styles.infoTile}>
                    <span>Correo</span>
                    <strong>{authSession.user.email}</strong>
                  </article>
                  <article className={styles.infoTile}>
                    <span>Verificacion</span>
                    <strong>{authSession.user.emailVerifiedAt ? 'Completada' : 'Pendiente'}</strong>
                  </article>
                  <article className={styles.infoTile}>
                    <span>Consentimientos</span>
                    <strong>{acceptedConsentsCount}/3 completos</strong>
                  </article>
                </div>
              </article>
            </section>
          </div>

          <aside className={`${styles.sideStack} ${styles.reveal}`}>
            <article className={styles.checklistCard}>
              <div className={styles.sectionHeaderCompact}>
                <div>
                  <p className={styles.kicker}>Checklist</p>
                  <h3>Estado del perfil</h3>
                </div>
                <StatusPill
                  label={requiresOnboarding ? 'Pendiente' : 'Completo'}
                  tone={requiresOnboarding ? 'warning' : 'success'}
                />
              </div>

              <div className={styles.checklistBox}>
                <ul className={styles.checklistList}>
                  {missingRequirementLabels.length ? (
                    missingRequirementLabels.map((label) => (
                      <li className={styles.checklistItem} key={label}>
                        <span className={styles.checkIcon}>!</span>
                        <strong>{label}</strong>
                      </li>
                    ))
                  ) : (
                    <li className={styles.checklistItem}>
                      <span className={styles.checkIconDone}>OK</span>
                      <strong>Tu perfil ya cumple los requisitos minimos.</strong>
                    </li>
                  )}
                </ul>
              </div>

              <div className={styles.infoStack}>
                <article className={styles.infoCard}>
                  <div className={styles.infoTop}>
                    <strong>Correo</strong>
                    <StatusPill
                      label={authSession.user.emailVerifiedAt ? 'Verificado' : 'Pendiente'}
                      tone={authSession.user.emailVerifiedAt ? 'success' : 'warning'}
                    />
                  </div>
                  <p>{authSession.user.email}</p>
                </article>

                <article className={styles.infoCard}>
                  <div className={styles.infoTop}>
                    <strong>Institucion activa</strong>
                    <StatusPill label={activeMembershipName} tone="neutral" />
                  </div>
                </article>
              </div>
            </article>

            <article className={styles.quickCard}>
              <div className={styles.sectionHeaderCompact}>
                <div>
                  <p className={styles.kicker}>Continuidad</p>
                  <h3>Accesos rapidos</h3>
                </div>
                <StatusPill label="Acciones" tone="neutral" />
              </div>

              <div className={styles.quickGrid}>
                <Link className={styles.quickLink} href="/conductor">
                  <strong>Conductor</strong>
                  <span>Valida tu estado y documentacion para operar.</span>
                </Link>
                <Link className={styles.quickLink} href="/vehiculos">
                  <strong>Vehiculos</strong>
                  <span>Registra y activa tu flota antes de publicar.</span>
                </Link>
                <Link className={styles.quickLink} href="/viajes">
                  <strong>Viajes</strong>
                  <span>Gestiona solicitudes y trayectos del dia.</span>
                </Link>
              </div>
            </article>
          </aside>
        </section>

        {isAvatarModalOpen ? (
          <div
            aria-labelledby="profile-avatar-modal-title"
            aria-modal="true"
            className="modal-backdrop"
            onClick={closeAvatarModal}
            role="dialog"
          >
            <div
              className={`modal-card modal-card-lg ${styles.avatarModalCard}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <p className={styles.kicker}>Avatar de perfil</p>
                  <h2 className="panel-title" id="profile-avatar-modal-title">
                    Vista previa y cambio de foto
                  </h2>
                  <p className="panel-text">
                    Elige la imagen que quieres usar en tu perfil.
                  </p>
                </div>
                <Button onClick={closeAvatarModal} variant="secondary">
                  Cerrar
                </Button>
              </div>

              <div className={styles.avatarModalBody}>
                <div className={styles.avatarPreviewStage}>
                  {avatarPreviewUrl || formState.profilePhotoUrl ? (
                    <img
                      alt="Vista previa del avatar"
                      className={styles.avatarPreviewImage}
                      src={avatarPreviewUrl ?? formState.profilePhotoUrl}
                    />
                  ) : (
                    <div className={styles.avatarPreviewFallback}>{userInitials}</div>
                  )}
                </div>

                <div className={styles.avatarModalSidebar}>
                  <div className={styles.avatarHintCard}>
                    <strong>Recomendado</strong>
                    <p>Usa una foto frontal, bien iluminada y con fondo limpio.</p>
                  </div>
                  <div className={styles.avatarHintCard}>
                    <strong>Formatos</strong>
                    <p>JPG, PNG o WEBP.</p>
                  </div>
                </div>
              </div>

              <div className="button-row">
                <Button
                  disabled={isUploadingPhoto}
                  onClick={() => {
                    suppressAuthSessionSync();
                    fileInputRef.current?.click();
                  }}
                  variant="secondary"
                >
                  {selectedAvatarFile ? 'Elegir otra imagen' : 'Seleccionar imagen'}
                </Button>
                <Button
                  disabled={isUploadingPhoto}
                  onClick={() => void handleProfilePhotoUpload()}
                  variant="primary"
                >
                  {isUploadingPhoto ? 'Guardando avatar...' : 'Guardar avatar'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {isEditModalOpen ? (
          <div
            aria-labelledby="profile-edit-modal-title"
            aria-modal="true"
            className="modal-backdrop"
            onClick={closeEditModal}
            role="dialog"
          >
            <div
              className={`modal-card modal-card-lg ${styles.editModalCard}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <p className={styles.kicker}>Perfil</p>
                  <h2 className="panel-title" id="profile-edit-modal-title">
                    {requiresOnboarding ? 'Completa tu perfil' : 'Editar perfil'}
                  </h2>
                  <p className="panel-text">
                    Actualiza tu informacion personal y tus consentimientos.
                  </p>
                </div>
                <Button
                  disabled={isSubmitting}
                  onClick={closeEditModal}
                  variant="secondary"
                >
                  Cerrar
                </Button>
              </div>

              <form className={`form-stack ${styles.editForm}`} onSubmit={handleSubmit}>
                <section className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p className={styles.kicker}>Datos base</p>
                      <h3>Informacion de contacto</h3>
                    </div>
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

                  <div className={styles.formGrid}>
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

                <section className={styles.formSection}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <p className={styles.kicker}>Consentimientos</p>
                      <h3>Compromisos institucionales</h3>
                    </div>
                    <p className={styles.sectionText}>
                      Requeridos para usar la plataforma.
                    </p>
                  </div>

                  <div className={styles.bulkActions}>
                    <Button
                      disabled={areAllEditableConsentsChecked}
                      onClick={handleSelectAllConsents}
                      type="button"
                      variant="secondary"
                    >
                      Aceptar todo
                    </Button>
                    <span className={styles.bulkHint}>
                      Marca todas las opciones disponibles con un solo clic.
                    </span>
                  </div>

                  <div className={styles.consentGrid}>
                    <label className={styles.consentCard}>
                      <input
                        checked={formState.acceptTerms}
                        className={styles.consentCheckbox}
                        disabled={Boolean(authSession.user.termsAcceptedAt)}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            acceptTerms: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      <div className={styles.consentBody}>
                        <strong>Acepto los terminos del servicio</strong>
                        <p>Necesario para usar SafeRidePro dentro de tu institucion.</p>
                      </div>
                    </label>

                    <label className={styles.consentCard}>
                      <input
                        checked={formState.acceptPrivacy}
                        className={styles.consentCheckbox}
                        disabled={Boolean(authSession.user.privacyAcceptedAt)}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            acceptPrivacy: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      <div className={styles.consentBody}>
                        <strong>Acepto la politica de privacidad</strong>
                        <p>Tu informacion se usa solo para la operacion institucional del sistema.</p>
                      </div>
                    </label>

                    <label className={styles.consentCard}>
                      <input
                        checked={formState.acceptSafetyRules}
                        className={styles.consentCheckbox}
                        disabled={Boolean(authSession.user.safetyRulesAcceptedAt)}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            acceptSafetyRules: event.target.checked,
                          }))
                        }
                        type="checkbox"
                      />
                      <div className={styles.consentBody}>
                        <strong>Acepto las reglas de seguridad</strong>
                        <p>Incluyen puntualidad, respeto, uso responsable y convivencia segura.</p>
                      </div>
                    </label>
                  </div>
                </section>

                <div className={styles.formActions}>
                  <Button
                    className={styles.primaryAction}
                    disabled={isSubmitting}
                    type="submit"
                    variant="primary"
                  >
                    {isSubmitting
                      ? 'Guardando...'
                      : requiresOnboarding
                        ? 'Completar perfil'
                        : 'Guardar cambios'}
                  </Button>
                  <Button
                    className={styles.secondaryAction}
                    disabled={isSubmitting}
                    onClick={closeEditModal}
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
      </section>
    </>
  );
}
