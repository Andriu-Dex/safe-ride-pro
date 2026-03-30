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
  showResetMessage?: boolean;
};

export function LoginPageContent({
  nextPath = '/dashboard',
  initialEmail,
  showVerifiedMessage = false,
  showResetMessage = false,
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
            <p className="kicker">Acceso web</p>
            <h1 className="hero-title">Bienvenido a SafeRidePro.</h1>
          </div>
          <p className="hero-text">
            Inicia sesion con tu cuenta institucional o crea una nueva para comenzar.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <strong>Acceso institucional seguro</strong>
              <p>Tu cuenta se verifica por correo y se mantiene activa con renovacion controlada de sesion.</p>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <LoginForm
            initialEmail={initialEmail}
            nextPath={nextPath}
            showVerifiedMessage={showVerifiedMessage}
            showResetMessage={showResetMessage}
          />
        </div>
      </section>
    </main>
  );
}
