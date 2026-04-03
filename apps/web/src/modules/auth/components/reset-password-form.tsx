'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { PasswordField } from '../../../components/ui/password-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { ApiError, resetPassword } from '../lib/auth-api';

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
      description: 'Agrega mayusculas, numeros o mayor longitud.',
      progress,
    };
  }

  if (score <= 3) {
    return {
      label: 'Media',
      tone: 'warning',
      description: 'Buena base. Puedes reforzarla con un simbolo.',
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

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];

    if (!code.trim()) {
      issues.push('Debes indicar el codigo de recuperacion.');
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      issues.push('La contrasena debe tener al menos 8 caracteres.');
    }

    if (password !== confirmPassword) {
      issues.push('La confirmacion de contrasena no coincide.');
    }

    return issues;
  }, [code, password, confirmPassword]);

  const canSubmit = !isSubmitting && validationIssues.length === 0;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resetPassword(code.trim(), password);
      setSuccessMessage(response.message);

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
        setErrorMessage('No fue posible actualizar la contrasena.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <p className="kicker">Nueva contrasena</p>
        <h2>Define tu nueva clave</h2>
        <p>Ingresa el codigo recibido y elige una nueva contrasena segura.</p>
      </div>

      {showSentMessage ? (
        <div className="form-helper form-helper-strong">
          {email
            ? `Te enviamos un codigo a ${maskEmail(email)}. Revisa tu bandeja e ingresalo aqui para continuar.`
            : 'Te enviamos un codigo de recuperacion. Revisalo e ingresalo aqui para continuar.'}
        </div>
      ) : null}

      <form className="form-stack" onSubmit={handleSubmit}>
        <InputField
          label="Codigo de recuperacion"
          onChange={(event) => setCode(event.target.value)}
          placeholder="Ingresa el codigo recibido"
          required
          value={code}
        />
        <PasswordField
          autoComplete="new-password"
          label="Nueva contrasena"
          hideLabel="Ocultar nueva contrasena"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimo 8 caracteres"
          required
          showLabel="Mostrar nueva contrasena"
          value={password}
        />
        <PasswordField
          autoComplete="new-password"
          label="Confirmar contrasena"
          hideLabel="Ocultar confirmacion de contrasena"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repite la nueva contrasena"
          required
          showLabel="Mostrar confirmacion de contrasena"
          value={confirmPassword}
        />

        {passwordStrength ? (
          <div className="password-strength-card" aria-live="polite">
            <div className="password-strength-header">
              <strong>Seguridad de la clave</strong>
              <StatusPill label={passwordStrength.label} tone={passwordStrength.tone} />
            </div>
            <div aria-hidden="true" className="password-strength-meter">
              <span
                className={[
                  'password-strength-fill',
                  `password-strength-fill-${passwordStrength.tone}`,
                ].join(' ')}
                style={{ width: `${passwordStrength.progress}%` }}
              />
            </div>
            <p className="password-strength-text">{passwordStrength.description}</p>
          </div>
        ) : null}

        {validationIssues.length ? (
          <div className="validation-card validation-card-danger">
            <strong>Antes de continuar:</strong>
            <ul className="validation-list">
              {validationIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        {successMessage ? <div className="form-success">{successMessage}</div> : null}

        <Button disabled={!canSubmit} type="submit">
          {isSubmitting ? 'Actualizando...' : 'Actualizar contrasena'}
        </Button>
      </form>

      <div className="button-row">
        <a className="button button-secondary" href="/forgot-password">
          Solicitar otro codigo
        </a>
      </div>
    </div>
  );
}
