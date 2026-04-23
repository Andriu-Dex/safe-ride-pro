'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';

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
  const [toast, setToast] = useState<{ title: string; message: string; type: 'error' | 'success' | 'info' } | null>(() => {
    if (showVerifiedMessage) return { title: 'Verificación exitosa', message: 'Correo verificado correctamente. Ya puedes iniciar sesión.', type: 'success' };
    if (showResetMessage) return { title: 'Clave actualizada', message: 'La clave se actualizó correctamente. Ya puedes iniciar sesión.', type: 'success' };
    return null;
  });

  const isBusy = isSigningIn || isPending;

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setToast(null);

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
        setToast({
          title: 'Error de acceso',
          message: error.message,
          type: 'error',
        });
        return;
      }

      setToast({
        title: 'Error de acceso',
        message: 'No fue posible iniciar sesión. Intenta nuevamente.',
        type: 'error',
      });
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <p className="kicker">Acceso institucional</p>
        <h2>Inicia sesión</h2>
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

        <Button disabled={isBusy} type="submit">
          {isBusy ? 'Ingresando...' : 'Iniciar sesión'}
        </Button>
      </form>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a
          className="auth-inline-link text-sm"
          href="/register"
        >
          Registrarse
        </a>
        <a
          className="auth-inline-link text-sm"
          href="/forgot-password"
        >
          Olvidé mi clave
        </a>
      </div>

      {toast && (
        <div className="toast-stack">
          <div className={`toast-card toast-card-${toast.type}`}>
            <div className="toast-card-copy">
              <strong>{toast.title}</strong>
              <p>{toast.message}</p>
            </div>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => setToast(null)}
              aria-label="Cerrar notificación"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
