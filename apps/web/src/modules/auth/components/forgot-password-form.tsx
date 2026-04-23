'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { ApiError, forgotPassword } from '../lib/auth-api';
import styles from './forgot-password-form.module.css';

type ForgotPasswordFormProps = {
  initialEmail?: string;
};

export function ForgotPasswordForm({ initialEmail = '' }: ForgotPasswordFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await forgotPassword(normalizedEmail);
      const searchParams = new URLSearchParams({
        email: normalizedEmail,
        sent: '1',
      });

      if (response.resetCode) {
        searchParams.set('code', response.resetCode);
      }

      router.replace(`/reset-password?${searchParams.toString()}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible enviar las instrucciones de recuperación.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`${styles.forgotFormCard} form-card`}>
      <div className={`${styles.forgotFormHeader} form-header`}>
        <p className={styles.kicker}>Recuperación</p>
        <h2>Restablece tu contraseña</h2>
        <p>Te enviaremos un código para crear una nueva contraseña.</p>
      </div>

      <form className={`${styles.forgotFormStack} form-stack`} onSubmit={handleSubmit}>
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

        <Button className={styles.submitButton} disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Enviando...' : 'Enviar código'}
        </Button>
      </form>

      <div className={styles.secondaryLinks}>
        <a className={styles.textLink} href="/login">
          Volver al inicio de sesión
        </a>
      </div>
    </div>
  );
}
