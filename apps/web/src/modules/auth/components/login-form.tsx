'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { PasswordField } from '../../../components/ui/password-field';
import { ApiError } from '../lib/auth-api';
import { useAuth } from '../hooks/use-auth';

type LoginFormProps = {
  initialEmail?: string;
  nextPath?: string;
  showVerifiedMessage?: boolean;
  showResetMessage?: boolean;
};

export function LoginForm({
  initialEmail = '',
  nextPath = '/inicio',
  showVerifiedMessage = false,
  showResetMessage = false,
}: LoginFormProps) {
  const router = useRouter();
  const { signIn, isSigningIn } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [helperMessage, setHelperMessage] = useState<string | null>(
    showVerifiedMessage
      ? 'Correo verificado correctamente. Ya puedes iniciar sesion.'
      : showResetMessage
        ? 'La clave se actualizo correctamente. Ya puedes iniciar sesion.'
        : null,
  );

  const isBusy = isSigningIn || isPending;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setHelperMessage(null);

    try {
      await signIn({
        email,
        password,
      });

      startTransition(() => {
        router.replace(nextPath);
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
        return;
      }

      setErrorMessage('No fue posible iniciar sesion. Intenta nuevamente.');
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <p className="kicker">Acceso institucional</p>
        <h2>Inicia sesion</h2>
        <p>Usa tu cuenta institucional para acceder a SafeRidePro.</p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <InputField
          autoComplete="email"
          label="Correo"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu-correo@institucion.edu"
          required
          type="email"
          value={email}
        />

        <PasswordField
          autoComplete="current-password"
          hideLabel="Ocultar clave"
          label="Clave de acceso"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Ingresa tu clave"
          required
          showLabel="Mostrar clave"
          value={password}
        />

        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        {helperMessage ? (
          <div className="form-helper form-helper-strong">{helperMessage}</div>
        ) : null}

        <Button disabled={isBusy} type="submit">
          {isBusy ? 'Ingresando...' : 'Iniciar sesion'}
        </Button>
      </form>

      <div className="button-row auth-secondary-actions">
        <a className="button button-secondary" href="/register">
          Registrarse 
        </a>
        <a className="button button-secondary" href="/forgot-password">
          Olvide mi clave
        </a>
      </div>
    </div>
  );
}
