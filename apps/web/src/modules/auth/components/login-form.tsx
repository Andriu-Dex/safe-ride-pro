'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { ApiError } from '../lib/auth-api';
import { useAuth } from '../hooks/use-auth';
import { getApiOrigin } from '../../../lib/api-client';

const DEMO_EMAIL = 'admin@uta.edu.ec';
const DEMO_PASSWORD = 'Admin12345';

type LoginFormProps = {
  initialEmail?: string;
  nextPath?: string;
  showVerifiedMessage?: boolean;
};

export function LoginForm({
  initialEmail = DEMO_EMAIL,
  nextPath = '/dashboard',
  showVerifiedMessage = false,
}: LoginFormProps) {
  const router = useRouter();
  const { signIn, isSigningIn } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [helperMessage, setHelperMessage] = useState<string | null>(
    showVerifiedMessage
      ? 'Correo verificado correctamente. Ya puedes iniciar sesion.'
      : null,
  );

  const isBusy = isSigningIn || isPending;
  const apiHealthUrl = `${getApiOrigin()}/api/health`;

  const handleUseDemoCredentials = (): void => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setHelperMessage('Se restauraron las credenciales demo precargadas.');
  };

  const handleCopyDemoCredentials = async (): Promise<void> => {
    const credentialSummary = `Correo: ${DEMO_EMAIL}\nContrasena: ${DEMO_PASSWORD}`;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(credentialSummary);
        setHelperMessage('Las credenciales demo se copiaron al portapapeles.');
        return;
      }
    } catch {
      // Fall back to a visible helper message when clipboard access is unavailable.
    }

    setHelperMessage(
      `No fue posible copiar automaticamente. Credenciales demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`,
    );
  };

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
        <h2>Inicia sesion en tu panel</h2>
        <p>
          Accede con tus credenciales para entrar al sistema.
        </p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <InputField
          autoComplete="email"
          hint="Usa tu cuenta institucional o tu cuenta administrativa registrada."
          label="Correo"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu-correo@institucion.edu"
          required
          type="email"
          value={email}
        />

        <InputField
          autoComplete="current-password"
          label="Contrasena"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Ingresa tu contrasena"
          required
          type="password"
          value={password}
        />

        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

        <div className="form-helper">Puedes entrar con una cuenta creada o usar las credenciales demo.</div>

        {helperMessage ? <div className="form-helper form-helper-strong">{helperMessage}</div> : null}

        <Button disabled={isBusy} type="submit">
          {isBusy ? 'Ingresando...' : 'Entrar al panel'}
        </Button>
      </form>

      <div className="button-row">
        <Button disabled={isBusy} onClick={handleUseDemoCredentials} variant="secondary">
          Restaurar demo
        </Button>
        <Button disabled={isBusy} onClick={() => void handleCopyDemoCredentials()} variant="ghost">
          Copiar credenciales
        </Button>
        <a className="button button-ghost" href="/register">
          Crear cuenta
        </a>
        <a className="button button-secondary" href={apiHealthUrl} rel="noreferrer" target="_blank">
          Ver salud del API
        </a>
      </div>
    </div>
  );
}


