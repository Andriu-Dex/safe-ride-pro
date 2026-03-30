'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppLogo } from '../../../components/ui/app-logo';
import { useAuth } from '../hooks/use-auth';
import { VerifyEmailForm } from './verify-email-form';

type VerifyEmailPageContentProps = {
  code?: string;
  email?: string;
};

export function VerifyEmailPageContent({
  code,
  email,
}: VerifyEmailPageContentProps) {
  const router = useRouter();
  const { authSession, isHydrated } = useAuth();

  useEffect(() => {
    if (isHydrated && authSession) {
      router.replace('/dashboard');
    }
  }, [authSession, isHydrated, router]);

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-showcase">
          <AppLogo />
          <div>
            <p className="kicker">Verificacion de cuenta</p>
            <h1 className="hero-title">Activa tu cuenta con un codigo.</h1>
          </div>
          <p className="hero-text">
            En esta fase el codigo se muestra directamente para pruebas. Una vez verificado, ya puedes iniciar sesion y usar los modulos disponibles.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <strong>Cuenta activada</strong>
              <p>La verificacion cambia el estado de la cuenta y habilita el inicio de sesion.</p>
            </div>
            <div className="feature-item">
              <strong>Flujo listo para crecer</strong>
              <p>Mas adelante este paso puede conectarse a correo real sin rehacer la experiencia base.</p>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <VerifyEmailForm email={email} initialCode={code} />
        </div>
      </section>
    </main>
  );
}
