'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { PasswordField } from '../../../components/ui/password-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { ApiError, resetPassword } from '../lib/auth-api';
import styles from './reset-password-form.module.css';

type ResetPasswordFormProps = {
  initialCode?: string;
  email?: string;
  showSentMessage?: boolean;
};

type PasswordStrength = {
  label: string;
  tone: 'danger' | 'warning' | 'success';
  description: string;
  progress: number;
};

const MIN_PASSWORD_LENGTH = 8;

function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) {
    return null;
  }

  let score = 0;

  if (password.length >= MIN_PASSWORD_LENGTH) {
    score += 1;
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  }

  if (/\d/.test(password)) {
    score += 1;
  }

  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) {
    score += 1;
  }

  const progress = Math.max(score, 1) * 25;

  if (score <= 1) {
    return {
      label: 'Baja',
      tone: 'danger',
      description: 'Agrega mayúsculas, números o mayor longitud.',
      progress,
    };
  }

  if (score <= 3) {
    return {
      label: 'Media',
      tone: 'warning',
      description: 'Buena base. Puedes reforzarla con un símbolo.',
      progress,
    };
  }

  return {
    label: 'Alta',
    tone: 'success',
    description: 'Clave segura para continuar.',
    progress,
  };
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? ''}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
}

export function ResetPasswordForm({
  initialCode = '',
  email,
  showSentMessage = false,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];

    if (!code.trim()) {
      issues.push('Debes indicar el código de recuperación.');
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      issues.push('La contraseña debe tener al menos 8 caracteres.');
    }

    if (password !== confirmPassword) {
      issues.push('La confirmación de contraseña no coincide.');
    }

    return issues;
  }, [code, password, confirmPassword]);

  const canSubmit = !isSubmitting;

  const pushToast = (title: string, description: string, tone: ToastItem['tone'] = 'error') => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setToasts([]);

    if (validationIssues.length > 0) {
      validationIssues.forEach((issue) => {
        pushToast('Revisa los datos del formulario', issue, 'error');
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resetPassword(code.trim(), password);
      setSuccessMessage(response.message);
      pushToast('Contraseña actualizada', response.message, 'success');

      window.setTimeout(() => {
        router.replace(
          email
            ? `/login?email=${encodeURIComponent(email)}&reset=1`
            : '/login?reset=1',
        );
      }, 900);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible actualizar la contraseña.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <div className={`${styles.resetFormCard} form-card`}>
        <div className={`${styles.resetFormHeader} form-header`}>
        <p className={styles.kicker}>Nueva contraseña</p>
        <h2>Define tu nueva clave</h2>
        <p>Ingresa el código recibido y elige una nueva contraseña segura.</p>
        </div>

      {showSentMessage ? (
        <div className="form-helper form-helper-strong">
          {email
            ? `Te enviamos un código a ${maskEmail(email)}. Revisa tu bandeja e ingrésalo aquí para continuar.`
            : 'Te enviamos un código de recuperación. Revísalo e ingrésalo aquí para continuar.'}
        </div>
      ) : null}

      <form className={`${styles.resetFormStack} form-stack`} onSubmit={handleSubmit}>
        <InputField
          label="Código de recuperación"
          onChange={(event) => setCode(event.target.value)}
          placeholder="Ingresa el código recibido"
          required
          value={code}
        />
        <PasswordField
          autoComplete="new-password"
          label="Nueva contraseña"
          hideLabel="Ocultar nueva contraseña"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mínimo 8 caracteres"
          required
          showLabel="Mostrar nueva contraseña"
          value={password}
        />
        <PasswordField
          autoComplete="new-password"
          label="Confirmar contraseña"
          hideLabel="Ocultar confirmación de contraseña"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repite la nueva contraseña"
          required
          showLabel="Mostrar confirmación de contraseña"
          value={confirmPassword}
        />

        {passwordStrength ? (
          <div className={styles.passwordStrengthCard} aria-live="polite">
            <div className={styles.passwordStrengthHeader}>
              <strong>Seguridad de la clave</strong>
              <StatusPill label={passwordStrength.label} tone={passwordStrength.tone} />
            </div>
            <div aria-hidden="true" className={styles.passwordStrengthMeter}>
              <span
                className={[
                  styles.passwordStrengthFill,
                  passwordStrength.tone === 'danger'
                    ? styles.passwordStrengthFillDanger
                    : passwordStrength.tone === 'warning'
                      ? styles.passwordStrengthFillWarning
                      : styles.passwordStrengthFillSuccess,
                ].join(' ')}
                style={{ width: `${passwordStrength.progress}%` }}
              />
            </div>
            <p className={styles.passwordStrengthText}>{passwordStrength.description}</p>
          </div>
        ) : null}

        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        {successMessage ? <div className="form-success">{successMessage}</div> : null}

        <Button className={styles.submitButton} disabled={!canSubmit} type="submit">
          {isSubmitting ? 'Actualizando...' : 'Actualizar contraseña'}
        </Button>
      </form>

      <div className={styles.secondaryLinks}>
        <a className="auth-inline-link" href="/forgot-password">
          Solicitar otro código
        </a>
      </div>
      </div>
    </>
  );
}
