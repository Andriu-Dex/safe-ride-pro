'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppLogo } from '../../components/ui/app-logo';
import { RegisterForm } from '../../modules/auth/components/register-form';
import { useAuth } from '../../modules/auth/hooks/use-auth';

export default function RegisterPage() {
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
            <p className="kicker">Onboarding MVP</p>
            <h1 className="hero-title">Crea tu cuenta institucional.</h1>
          </div>
          <p className="hero-text">
            Registra tu cuenta, valida tu correo y entra al sistema como pasajero.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <strong>Registro por institucion</strong>
              <p>El dominio del correo define si la institucion esta autorizada dentro del sistema.</p>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <RegisterForm />
        </div>
      </section>
    </main>
  );
}
