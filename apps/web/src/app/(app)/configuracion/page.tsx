'use client';

import {
  GlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { TextareaField } from '../../../components/ui/textarea-field';
import { ToastStack, type ToastItem } from '../../../components/ui/toast-stack';
import { ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { canAccessAudit } from '../../../modules/audit/lib/audit-access';
import {
  getInstitutionSettings,
  updateInstitutionSettings,
} from '../../../modules/institutions/lib/institution-api';
import type { UpdateInstitutionSettingsInput } from '../../../modules/institutions/types/institution-settings';
import styles from './page.module.css';

type SettingsFormState = UpdateInstitutionSettingsInput;

function getApiErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

const EMPTY_FORM: SettingsFormState = {
  allowCashPayments: true,
  allowPaypalPayments: true,
  termsDocumentUrl: '',
  privacyPolicyUrl: '',
  safetyRulesTitle: '',
  safetyRulesSummary: '',
  safetyRulesBody: '',
};

export default function ConfigurationPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();

  const [selectedInstitutionId, setSelectedInstitutionId] = useState('');
  const [formState, setFormState] = useState<SettingsFormState>(EMPTY_FORM);
  const [initialState, setInitialState] = useState<SettingsFormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [institutionName, setInstitutionName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((title: string, description: string, tone: ToastItem['tone']) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `settings-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const manageableMemberships = useMemo(() => {
    if (!authSession) {
      return [];
    }

    return authSession.user.memberships.filter((membership) => {
      if (membership.membershipStatus !== MembershipStatus.Active) {
        return false;
      }

      if (membership.institutionIsActive === false) {
        return false;
      }

      return (
        authSession.user.globalRole === GlobalUserRole.SuperAdmin ||
        membership.role === InstitutionMembershipRole.InstitutionAdmin
      );
    });
  }, [authSession]);

  useEffect(() => {
    if (!selectedInstitutionId && manageableMemberships.length > 0) {
      setSelectedInstitutionId(manageableMemberships[0].institutionId);
    }
  }, [manageableMemberships, selectedInstitutionId]);

  const loadSettings = useCallback(async () => {
    if (!authSession || !selectedInstitutionId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getInstitutionSettings(authSession.accessToken, selectedInstitutionId);
      const nextState: SettingsFormState = {
        allowCashPayments: response.settings.allowCashPayments,
        allowPaypalPayments: response.settings.allowPaypalPayments,
        termsDocumentUrl: response.settings.termsDocumentUrl ?? '',
        privacyPolicyUrl: response.settings.privacyPolicyUrl ?? '',
        safetyRulesTitle: response.settings.safetyRulesTitle,
        safetyRulesSummary: response.settings.safetyRulesSummary,
        safetyRulesBody: response.settings.safetyRulesBody,
      };

      setInstitutionName(response.institution.name);
      setFormState(nextState);
      setInitialState(nextState);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible cargar la configuracion institucional.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [authSession, refreshSession, selectedInstitutionId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession || !selectedInstitutionId) {
      setIsLoading(false);
      return;
    }

    void loadSettings();
  }, [authSession, isHydrated, loadSettings, selectedInstitutionId]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    pushToast('No fue posible continuar', errorMessage, 'error');
    setErrorMessage(null);
  }, [errorMessage, pushToast]);

  const handleTextChange = (
    field: keyof Omit<SettingsFormState, 'allowCashPayments' | 'allowPaypalPayments'>,
    value: string,
  ) => {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  };

  const handleToggleChange = (
    field: 'allowCashPayments' | 'allowPaypalPayments',
    checked: boolean,
  ) => {
    setFormState((currentState) => ({
      ...currentState,
      [field]: checked,
    }));
  };

  const handleReset = () => {
    setFormState(initialState);
  };

  const handleSave = async () => {
    if (!authSession || !selectedInstitutionId) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await updateInstitutionSettings(
        authSession.accessToken,
        {
          allowCashPayments: formState.allowCashPayments,
          allowPaypalPayments: formState.allowPaypalPayments,
          termsDocumentUrl: (formState.termsDocumentUrl ?? '').trim(),
          privacyPolicyUrl: (formState.privacyPolicyUrl ?? '').trim(),
          safetyRulesTitle: formState.safetyRulesTitle.trim(),
          safetyRulesSummary: formState.safetyRulesSummary.trim(),
          safetyRulesBody: formState.safetyRulesBody.trim(),
        },
        selectedInstitutionId,
      );

      const nextState: SettingsFormState = {
        allowCashPayments: response.settings.allowCashPayments,
        allowPaypalPayments: response.settings.allowPaypalPayments,
        termsDocumentUrl: response.settings.termsDocumentUrl ?? '',
        privacyPolicyUrl: response.settings.privacyPolicyUrl ?? '',
        safetyRulesTitle: response.settings.safetyRulesTitle,
        safetyRulesSummary: response.settings.safetyRulesSummary,
        safetyRulesBody: response.settings.safetyRulesBody,
      };

      setInstitutionName(response.institution.name);
      setFormState(nextState);
      setInitialState(nextState);
      pushToast('Configuracion guardada', response.message, 'success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible guardar la configuracion institucional.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const showPageAccessError =
    isHydrated &&
    (!authSession || !canAccessAudit(authSession.user) || manageableMemberships.length === 0);
  const awaitingInstitutionSelection =
    isHydrated &&
    manageableMemberships.length > 0 &&
    !selectedInstitutionId;

  if (isLoading || awaitingInstitutionSelection) {
    return (
      <section className={styles.pageBackground}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <article className={`${styles.canvas} ${styles.canvasSmall}`}>
          <div aria-hidden="true" className={styles.loadingPulse} />
          <h1 className={styles.stateTitle}>Cargando configuracion</h1>
          <p className={styles.stateText}>
            Estamos preparando las reglas institucionales de este entorno.
          </p>
        </article>
      </section>
    );
  }

  if (showPageAccessError) {
    return (
      <section className={styles.pageBackground}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <article className={`${styles.canvas} ${styles.canvasSmall}`}>
          <h1 className={styles.stateTitle}>Configuracion no disponible</h1>
          <p className={styles.stateText}>
            Esta vista solo esta disponible para administracion institucional con una institucion activa.
          </p>
        </article>
      </section>
    );
  }

  return (
    <section className={styles.pageBackground}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <article className={styles.canvas}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Configuracion</p>
              <h1 className={styles.heroTitle}>Parametros generales</h1>
              <p className={styles.heroLead}>
                Define medios de pago, enlaces legales y reglas visibles antes de reservar.
              </p>
            </div>

            <div className={styles.heroActions}>
              <Button disabled={isLoading} onClick={() => void loadSettings()} variant="secondary">
                Actualizar
              </Button>
            </div>
          </div>
        </section>

        <section className={styles.contentGrid}>
          <aside className={styles.sideColumn}>
            <section className={styles.sideSection}>
              <p className={styles.sectionKicker}>Institucion</p>
              <h2 className={styles.sideTitle}>Contexto administrativo</h2>

              {manageableMemberships.length > 1 ? (
                <SelectField
                  label="Institucion activa"
                  onChange={(event) => setSelectedInstitutionId(event.target.value)}
                  value={selectedInstitutionId}
                >
                  {manageableMemberships.map((membership) => (
                    <option key={membership.id} value={membership.institutionId}>
                      {membership.institutionName}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <div className={styles.identityBlock}>
                  <strong>{institutionName || manageableMemberships[0]?.institutionName}</strong>
                  <span>Gestionas los parametros visibles para reservas y pagos.</span>
                </div>
              )}
            </section>

            <section className={styles.sideSection}>
              <p className={styles.sectionKicker}>Impacto</p>
              <h2 className={styles.sideTitle}>Que controlas aqui</h2>
              <ul className={styles.sideList}>
                <li>Si la institucion permite reservas con efectivo o PayPal.</li>
                <li>Los enlaces legales que el usuario puede consultar antes de reservar.</li>
                <li>Las reglas minimas que aparecen en el compromiso previo a la solicitud.</li>
              </ul>
            </section>
          </aside>

          <div className={styles.mainColumn}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionKicker}>Pagos</p>
                  <h2 className={styles.sectionTitle}>Medios habilitados</h2>
                </div>
              </div>

              <div className={styles.toggleStack}>
                <label className={styles.toggleRow}>
                  <div>
                    <strong>Efectivo</strong>
                    <span>Permite que el pasajero reserve y pague al finalizar el viaje.</span>
                  </div>
                  <input
                    checked={formState.allowCashPayments}
                    onChange={(event) =>
                      handleToggleChange('allowCashPayments', event.target.checked)}
                    type="checkbox"
                  />
                </label>

                <label className={styles.toggleRow}>
                  <div>
                    <strong>PayPal</strong>
                    <span>Permite que el pasajero complete el pago digital antes del trayecto.</span>
                  </div>
                  <input
                    checked={formState.allowPaypalPayments}
                    onChange={(event) =>
                      handleToggleChange('allowPaypalPayments', event.target.checked)}
                    type="checkbox"
                  />
                </label>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionKicker}>Enlaces legales</p>
                  <h2 className={styles.sectionTitle}>Referencias visibles para el usuario</h2>
                </div>
              </div>

              <div className={styles.formGrid}>
                <InputField
                  label="URL de terminos"
                  onChange={(event) => handleTextChange('termsDocumentUrl', event.target.value)}
                  placeholder="https://..."
                  value={formState.termsDocumentUrl}
                />
                <InputField
                  label="URL de privacidad"
                  onChange={(event) => handleTextChange('privacyPolicyUrl', event.target.value)}
                  placeholder="https://..."
                  value={formState.privacyPolicyUrl}
                />
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionKicker}>Compromiso previo</p>
                  <h2 className={styles.sectionTitle}>Reglas minimas de seguridad</h2>
                </div>
              </div>

              <div className={styles.formStack}>
                <InputField
                  label="Titulo"
                  onChange={(event) => handleTextChange('safetyRulesTitle', event.target.value)}
                  placeholder="Reglas minimas de seguridad"
                  value={formState.safetyRulesTitle}
                />

                <TextareaField
                  label="Resumen visible"
                  onChange={(event) => handleTextChange('safetyRulesSummary', event.target.value)}
                  placeholder="Resumen breve para la interfaz antes de reservar."
                  rows={3}
                  value={formState.safetyRulesSummary}
                />

                <TextareaField
                  label="Detalle completo"
                  onChange={(event) => handleTextChange('safetyRulesBody', event.target.value)}
                  placeholder="Escribe una regla por linea o por parrafos."
                  rows={8}
                  value={formState.safetyRulesBody}
                />
              </div>
            </section>

            <div className={styles.actionBar}>
              <div className={styles.actionCopy}>
                <strong>{institutionName || 'Institucion activa'}</strong>
                <span>Los cambios se aplican sobre nuevas reservas y lecturas visibles en interfaz.</span>
              </div>
              <div className={styles.actionButtons}>
                <Button disabled={isSaving} onClick={handleReset} variant="ghost">
                  Restablecer
                </Button>
                <Button disabled={isSaving} onClick={() => void handleSave()}>
                  {isSaving ? 'Guardando...' : 'Guardar configuracion'}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </article>
    </section>
  );
}
