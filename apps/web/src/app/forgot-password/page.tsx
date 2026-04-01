'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppLogo } from '../../components/ui/app-logo';
import { ForgotPasswordForm } from '../../modules/auth/components/forgot-password-form';
import { useAuth } from '../../modules/auth/hooks/use-auth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { authSession, isHydrated } = useAuth();

  useEffect(() => {
    if (isHydrated && authSession) {
      router.replace('/inicio');
    }
  }, [authSession, isHydrated, router]);

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-showcase">
          <AppLogo />
          <div>
            <p className="kicker">Recuperacion</p>
            <h1 className="hero-title">Recupera tu acceso.</h1>
          </div>
          <p className="hero-text">
            Si olvidaste tu contrasena, te enviaremos un codigo de recuperacion a tu correo.
          </p>
        </div>

        <div className="login-form-panel">
          <ForgotPasswordForm />
        </div>
      </section>
    </main>
  );
}
