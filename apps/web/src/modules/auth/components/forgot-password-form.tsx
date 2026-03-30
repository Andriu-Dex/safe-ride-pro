'use client';

import { useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { ApiError, forgotPassword } from '../lib/auth-api';

type ForgotPasswordFormProps = {
  initialEmail?: string;
};

export function ForgotPasswordForm({ initialEmail = '' }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [developmentCode, setDevelopmentCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setDevelopmentCode(null);
    setIsSubmitting(true);

    try {
      const response = await forgotPassword(email.trim().toLowerCase());
      setSuccessMessage(response.message);
      setDevelopmentCode(response.resetCode ?? null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible enviar las instrucciones de recuperacion.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <p className="kicker">Recuperacion</p>
        <h2>Restablece tu contrasena</h2>
        <p>Te enviaremos un codigo para crear una nueva contrasena.</p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <InputField
          autoComplete="email"
          label="Correo institucional"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu-correo@institucion.edu"
          required
          type="email"
          value={email}
        />

        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        {successMessage ? <div className="form-success">{successMessage}</div> : null}
        {developmentCode ? (
          <div className="form-helper form-helper-strong">
            Codigo de desarrollo: <strong>{developmentCode}</strong>
          </div>
        ) : null}

        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Enviando...' : 'Enviar codigo'}
        </Button>
      </form>

      <div className="button-row">
        <a className="button button-secondary" href="/login">
          Volver al inicio de sesion
        </a>
      </div>
    </div>
  );
}
