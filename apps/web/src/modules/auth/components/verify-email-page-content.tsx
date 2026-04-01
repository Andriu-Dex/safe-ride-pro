'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
      router.replace('/inicio');
    }
  }, [authSession, isHydrated, router]);

  return (
    <main className="register-shell">
      <section className="register-layout verify-layout">
        <header className="register-showcase verify-showcase">
          <div className="register-showcase-copy">
            <img
              alt="Logo de SafeRidePro"
              className="auth-hero-logo"
              loading="eager"
              src="https://i.imgur.com/7UUGKrJ.png"
            />
            <div>
              <p className="kicker">Verificacion de cuenta</p>
              <h1 className="verify-title">Revisa tu correo y activa tu acceso.</h1>
            </div>
            <p>
              Te enviamos un codigo de seis digitos para completar el registro de tu cuenta
              institucional en SafeRidePro.
            </p>
          </div>

          <div className="verify-info-grid">
            <div className="feature-item">
              <strong>Paso final del registro</strong>
              <p>Al verificar el correo, la cuenta queda habilitada para iniciar sesion.</p>
            </div>
            <div className="feature-item">
              <strong>Si no llega el mensaje</strong>
              <p>Podras reenviar el codigo desde la misma pantalla sin perder el progreso.</p>
            </div>
          </div>
        </header>

        <div className="register-form-wrapper verify-form-wrapper">
          <VerifyEmailForm email={email} initialCode={code} />
        </div>
      </section>
    </main>
  );
}
