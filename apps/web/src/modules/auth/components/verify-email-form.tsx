'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { ApiError, resendVerificationCode, verifyEmail } from '../lib/auth-api';
import { useAuth } from '../hooks/use-auth';

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [developmentCode, setDevelopmentCode] = useState<string | null>(initialCode || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];

    if (!code.trim()) {
      issues.push('Debes indicar el codigo de verificacion.');
    }

    return issues;
  }, [code]);

  const canSubmit = !isSubmitting;
  const shouldShowValidationIssues = hasAttemptedSubmit && validationIssues.length > 0;

  const runVerification = async () => {
    setHasAttemptedSubmit(true);

    if (validationIssues.length > 0) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setResendMessage(null);

    try {
      const response = await verifyEmail(code.trim());
      setSuccessMessage(response.message);
      await establishSession({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
      router.replace('/dashboard');
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
    setResendMessage(null);

    try {
      const response = await resendVerificationCode(email);
      setResendMessage(response.message);
      setDevelopmentCode(
        response.deliveryChannel === 'development_preview'
          ? response.verificationCode ?? null
          : null,
      );
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible reenviar el codigo en este momento.');
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <p className="kicker">Verificacion</p>
        <h2>Activa tu cuenta</h2>
        <p>Confirma tu correo institucional para habilitar el inicio de sesión.</p>
      </div>

      {email ? (
        <div className="verify-email-summary">
          Enviamos el codigo a <strong>{maskEmailAddress(email)}</strong>. Revisa tu bandeja de
          entrada y spam antes de solicitar un nuevo envio.
        </div>
      ) : null}

      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void runVerification();
        }}
      >
        <InputField
          autoComplete="one-time-code"
          hint="Revisa tu correo institucional y escribe el código recibido."
          inputMode="numeric"
          label="Código de verificación"
          maxLength={6}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="Ingresa el código de 6 dígitos"
          required
          value={code}
        />

        {developmentCode ? (
            <div className="form-helper form-helper-strong">
            Código de desarrollo: <strong>{developmentCode}</strong>
          </div>
        ) : null}

        {shouldShowValidationIssues ? (
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
        {resendMessage ? <div className="form-helper">{resendMessage}</div> : null}

        <Button disabled={!canSubmit} type="submit">
          {isSubmitting ? 'Verificando...' : 'Verificar correo'}
        </Button>
      </form>

      <div className="button-row verify-actions">
        <Button
          className="verify-secondary-button"
          disabled={isResending || !email}
          onClick={() => void runResend()}
          variant="secondary"
        >
          {isResending ? 'Reenviando...' : 'Reenviar código'}
        </Button>
        <Button
          className="verify-secondary-button"
          disabled={!successMessage}
          onClick={() =>
            router.replace(
              email
                ? `/login?email=${encodeURIComponent(email)}&verified=1`
                : '/login?verified=1',
            )
          }
          variant="secondary"
        >
          Ir al login
        </Button>
        <a className="button button-secondary verify-secondary-button" href="/register">
          Volver al registro
        </a>
      </div>
    </div>
  );
}
