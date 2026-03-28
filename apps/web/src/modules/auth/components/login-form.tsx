'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { ApiError } from '../lib/auth-api';
import { useAuth } from '../hooks/use-auth';

export function LoginForm() {
  const router = useRouter();
  const { signIn, isSigningIn } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('admin@uta.edu.ec');
  const [password, setPassword] = useState('Admin12345');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = isSigningIn || isPending;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    try {
      await signIn({
        email,
        password,
      });

      startTransition(() => {
        router.replace('/dashboard');
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
          Accede con tus credenciales para revisar solicitudes, registrar vehiculos y gestionar viajes.
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

        <div className="form-helper">
          El flujo de registro llegara en una siguiente iteracion. Por ahora el ingreso se valida contra el API.
        </div>

        <Button disabled={isBusy} type="submit">
          {isBusy ? 'Ingresando...' : 'Entrar al panel'}
        </Button>
      </form>

      <div className="button-row">
        <a className="button button-secondary" href="http://localhost:3002/api/audit/events" rel="noreferrer" target="_blank">
          Ver endpoint de auditoria
        </a>
      </div>
    </div>
  );
}


