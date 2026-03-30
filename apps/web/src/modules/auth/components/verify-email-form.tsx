'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { ApiError, verifyEmail } from '../lib/auth-api';

type VerifyEmailFormProps = {
  initialCode?: string;
  email?: string;
};

export function VerifyEmailForm({ initialCode = '', email }: VerifyEmailFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];

    if (!code.trim()) {
      issues.push('Debes indicar el codigo de verificacion.');
    }

    return issues;
  }, [code]);

  const canSubmit = !isSubmitting && validationIssues.length === 0;

  const runVerification = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await verifyEmail(code.trim());
      setSuccessMessage(response.message);
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

  return (
    <div className="form-card">
      <div className="form-header">
        <p className="kicker">Verificacion</p>
        <h2>Activa tu cuenta</h2>
        <p>
          Confirma el correo institucional para habilitar el inicio de sesion en SafeRidePro.
        </p>
      </div>

      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          void runVerification();
        }}
      >
        <InputField
          hint="Por ahora este codigo se muestra directamente para pruebas. El envio real por correo se puede conectar despues."
          label="Codigo de verificacion"
          onChange={(event) => setCode(event.target.value)}
          placeholder="Ingresa el codigo de 6 digitos"
          required
          value={code}
        />

        {initialCode ? (
          <div className="form-helper form-helper-strong">
            Codigo de prueba: <strong>{initialCode}</strong>
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
          {isSubmitting ? 'Verificando...' : 'Verificar correo'}
        </Button>
      </form>

      <div className="button-row">
        <Button
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
        <a className="button button-ghost" href="/register">
          Volver al registro
        </a>
      </div>
    </div>
  );
}
