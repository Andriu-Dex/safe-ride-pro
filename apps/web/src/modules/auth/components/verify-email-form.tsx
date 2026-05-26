'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { persistToast } from '../../../components/ui/flash-toast';
import { InputField } from '../../../components/ui/input-field';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { ApiError, resendVerificationCode, verifyEmail } from '../lib/auth-api';
import { useAuth } from '../hooks/use-auth';
import styles from './verify-email-form.module.css';

type VerifyEmailFormProps = {
  initialCode?: string;
  email?: string;
};

function maskEmailAddress(email: string): string {
  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) {
    return email;
  }

  if (localPart.length <= 3) {
    return `${localPart[0] ?? ''}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
}

export function VerifyEmailForm({ initialCode = '', email }: VerifyEmailFormProps) {
  const router = useRouter();
  const { establishSession } = useAuth();
  const [code, setCode] = useState(initialCode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [developmentCode, setDevelopmentCode] = useState(initialCode || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];

    if (!code.trim()) {
      issues.push('Debes indicar el código de verificación.');
    }

    return issues;
  }, [code]);

  const canSubmit = !isSubmitting;
  const shouldShowValidationIssues = hasAttemptedSubmit && validationIssues.length > 0;

  const pushToast = (title: string, description: string, tone: ToastItem['tone'] = 'error') => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `verify-email-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  };

  const runVerification = async () => {
    setHasAttemptedSubmit(true);

    if (validationIssues.length > 0) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setToasts([]);

    try {
      const response = await verifyEmail(code.trim());
      persistToast({
        title: 'Correo verificado correctamente',
        description: response.message,
        tone: 'success',
      });
      await establishSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      router.replace('/inicio');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible verificar el correo en este momento.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const runResend = async () => {
    if (!email) {
      return;
    }

    setIsResending(true);
    setErrorMessage(null);

    try {
      const response = await resendVerificationCode(email);
      pushToast('Código reenviado', response.message, 'info');
      setDevelopmentCode(
        response.deliveryChannel === 'development_preview'
          ? response.verificationCode ?? null
          : null,
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible reenviar el código en este momento.');
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />
      <div className={`${styles.verifyFormCard} form-card`}>
        <div className={`${styles.verifyFormHeader} form-header`}>
          <p className={styles.kicker}>Código de acceso</p>
          <h2>Activa tu cuenta</h2>
          <p>Ingresa el código que recibiste y habilita tu acceso en un instante.</p>
        </div>

        {email ? (
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>Destino confirmado</span>
            <div>
              Enviamos el código a <strong>{maskEmailAddress(email)}</strong>.
            </div>
          </div>
        ) : null}

        <form
          className={`${styles.verifyFormStack} form-stack`}
          onSubmit={(event) => {
            event.preventDefault();
            void runVerification();
          }}
        >
          <InputField
            autoComplete="one-time-code"
            hint="Escribe el código de 6 dígitos que recibiste por correo."
            inputMode="numeric"
            label="Código de verificación"
            maxLength={6}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Ingresa el código de 6 dígitos"
            required
            value={code}
          />

          {developmentCode ? (
            <div className={styles.developmentCode}>
              Código de desarrollo: <strong>{developmentCode}</strong>
            </div>
          ) : null}

          {shouldShowValidationIssues ? (
            <div className={styles.validationCard}>
              <strong>Antes de continuar:</strong>
              <ul className={styles.validationList}>
                {validationIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

          <Button className={styles.submitButton} disabled={!canSubmit} type="submit">
            {isSubmitting ? 'Verificando...' : 'Verificar correo'}
          </Button>
        </form>

        <div className={styles.footerActions}>
          <button
            type="button"
            className={styles.inlineAction}
            disabled={isResending || !email}
            onClick={() => void runResend()}
          >
            {isResending ? 'Reenviando...' : 'Reenviar código de verificación'}
          </button>

          <div className={styles.navigationActions}>
            <button
              type="button"
              className={styles.navigationAction}
              onClick={() =>
                router.push(
                  email
                    ? `/login?email=${encodeURIComponent(email)}`
                    : '/login',
                )
              }
            >
              Ir a inicio de sesion
            </button>
            <span>•</span>
            <button
              type="button"
              className={styles.navigationAction}
              onClick={() =>
                router.push(
                  email
                    ? `/register?email=${encodeURIComponent(email)}`
                    : '/register',
                )
              }
            >
              Volver al registro
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
