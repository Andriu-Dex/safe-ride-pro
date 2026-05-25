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
  allowWalletPayments: true,
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
        allowWalletPayments: response.settings.allowWalletPayments,
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
    field: keyof Omit<SettingsFormState, 'allowCashPayments' | 'allowPaypalPayments' | 'allowWalletPayments'>,
    value: string,
  ) => {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  };

  const handleToggleChange = (
    field: 'allowCashPayments' | 'allowPaypalPayments' | 'allowWalletPayments',
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
          allowWalletPayments: formState.allowWalletPayments,
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
        allowWalletPayments: response.settings.allowWalletPayments,
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
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <div className={styles.loadingShell}>
          <article className={styles.stateCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.stateTitle}>Cargando configuración</h1>
            <p className={styles.stateText}>Estamos preparando las reglas institucionales.</p>
          </article>
        </div>
      </section>
    );
  }

  if (showPageAccessError) {
    return (
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <div className={styles.loadingShell}>
          <article className={styles.stateCard}>
            <h1 className={styles.stateTitle}>Configuración no disponible</h1>
            <p className={styles.stateText}>Esta vista solo está disponible para administración institucional.</p>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <header className={styles.heroHeader}>
        <div>
          <h1 className={styles.heroTitle}>Configuración General</h1>
          <p className={styles.heroSubtitle}>Gestiona parámetros, enlaces legales y reglas visibles institucionales.</p>
        </div>
        <Button disabled={isLoading} onClick={() => void loadSettings()} variant="secondary">
          Actualizar Datos
        </Button>
      </header>

      <div className={styles.content}>
        <div className={styles.institutionSelector}>
          <div>
            <h2 className={styles.cardTitle}>Institución Activa</h2>
            <p className={styles.toggleInfo} style={{ marginTop: '0.2rem', color: '#5a6c72' }}>
              Los cambios aplicarán a todas las reservas de esta institución.
            </p>
          </div>
          {manageableMemberships.length > 1 ? (
            <div style={{ minWidth: '280px' }}>
              <SelectField
                label=""
                onChange={(event) => setSelectedInstitutionId(event.target.value)}
                value={selectedInstitutionId}
              >
                {manageableMemberships.map((membership) => (
                  <option key={membership.id} value={membership.institutionId}>
                    {membership.institutionName}
                  </option>
                ))}
              </SelectField>
            </div>
          ) : (
            <strong style={{ fontSize: '1.1rem', color: '#162e33' }}>
              {institutionName || manageableMemberships[0]?.institutionName}
            </strong>
          )}
        </div>

        <div className={styles.settingsGrid}>
          <div className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Medios de Pago Habilitados</h2>
            </div>
            <label className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <strong>Efectivo</strong>
                <span>Pago presencial al finalizar el viaje.</span>
              </div>
              <input
                checked={formState.allowCashPayments}
                onChange={(event) => handleToggleChange('allowCashPayments', event.target.checked)}
                type="checkbox"
              />
            </label>
            <label className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <strong>PayPal</strong>
                <span>Pago digital previo al trayecto.</span>
              </div>
              <input
                checked={formState.allowPaypalPayments}
                onChange={(event) => handleToggleChange('allowPaypalPayments', event.target.checked)}
                type="checkbox"
              />
            </label>
            <label className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <strong>Billetera</strong>
                <span>Saldo interno recargado con PayPal.</span>
              </div>
              <input
                checked={formState.allowWalletPayments}
                onChange={(event) => handleToggleChange('allowWalletPayments', event.target.checked)}
                type="checkbox"
              />
            </label>
          </div>

          <div className={styles.settingsCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Enlaces Legales</h2>
            </div>
            <div className={styles.formGrid}>
              <InputField
                label="URL de Términos y Condiciones"
                onChange={(event) => handleTextChange('termsDocumentUrl', event.target.value)}
                placeholder="https://..."
                value={formState.termsDocumentUrl}
              />
              <InputField
                label="URL de Políticas de Privacidad"
                onChange={(event) => handleTextChange('privacyPolicyUrl', event.target.value)}
                placeholder="https://..."
                value={formState.privacyPolicyUrl}
              />
            </div>
          </div>

          <div className={`${styles.settingsCard} ${styles.settingsCardFull}`}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Compromiso Previo de Seguridad</h2>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formRow}>
                <InputField
                  label="Título de las reglas"
                  onChange={(event) => handleTextChange('safetyRulesTitle', event.target.value)}
                  placeholder="Ej. Reglas mínimas de seguridad"
                  value={formState.safetyRulesTitle}
                />
                <TextareaField
                  label="Resumen visible al reservar"
                  onChange={(event) => handleTextChange('safetyRulesSummary', event.target.value)}
                  placeholder="Mensaje corto mostrado en el modal de reserva."
                  rows={3}
                  value={formState.safetyRulesSummary}
                />
              </div>
              <TextareaField
                label="Detalle completo de normativas"
                onChange={(event) => handleTextChange('safetyRulesBody', event.target.value)}
                placeholder="Escribe el cuerpo completo de las reglas institucionales..."
                rows={6}
                value={formState.safetyRulesBody}
              />
            </div>

            <div className={styles.footerActions}>
              <Button disabled={isSaving} onClick={handleReset} variant="ghost">
                Restablecer
              </Button>
              <Button disabled={isSaving} onClick={() => void handleSave()}>
                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
