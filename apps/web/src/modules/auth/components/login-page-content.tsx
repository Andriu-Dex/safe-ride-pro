'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppLogo } from '../../../components/ui/app-logo';
import { useAuth } from '../hooks/use-auth';
import { LoginForm } from './login-form';

type LoginPageContentProps = {
  nextPath?: string;
  initialEmail?: string;
  showVerifiedMessage?: boolean;
};

export function LoginPageContent({
  nextPath = '/dashboard',
  initialEmail,
  showVerifiedMessage = false,
}: LoginPageContentProps) {
  const router = useRouter();
  const { authSession, isHydrated } = useAuth();

  useEffect(() => {
    if (isHydrated && authSession) {
      router.replace(nextPath);
    }
  }, [authSession, isHydrated, nextPath, router]);

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-showcase">
          <AppLogo />
          <div>
            <p className="kicker">Portal web MVP</p>
            <h1 className="hero-title">Ingresa a tu cuenta.</h1>
          </div>
          <p className="hero-text">
            Entra con tu cuenta institucional o crea una nueva para comenzar como pasajero.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <strong>Acceso institucional</strong>
              <p>El login valida credenciales reales contra el API y mantiene tu sesion activa.</p>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <LoginForm
            initialEmail={initialEmail}
            nextPath={nextPath}
            showVerifiedMessage={showVerifiedMessage}
          />
        </div>
      </section>
    </main>
  );
}
