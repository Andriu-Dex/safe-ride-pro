'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { ApiError, resetPassword } from '../lib/auth-api';

type ResetPasswordFormProps = {
  initialCode?: string;
  email?: string;
};

export function ResetPasswordForm({ initialCode = '', email }: ResetPasswordFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];

    if (!code.trim()) {
      issues.push('Debes indicar el codigo de recuperacion.');
    }

    if (password.length < 8) {
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

      <form className="form-stack" onSubmit={handleSubmit}>
        <InputField
          label="Codigo de recuperacion"
          onChange={(event) => setCode(event.target.value)}
          placeholder="Ingresa el codigo recibido"
          required
          value={code}
        />
        <InputField
          autoComplete="new-password"
          label="Nueva contrasena"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimo 8 caracteres"
          required
          type="password"
          value={password}
        />
        <InputField
          autoComplete="new-password"
          label="Confirmar contrasena"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repite la nueva contrasena"
          required
          type="password"
          value={confirmPassword}
        />

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
