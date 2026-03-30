'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AppLogo } from '../../components/ui/app-logo';
import { RegisterForm } from '../../modules/auth/components/register-form';
import { useAuth } from '../../modules/auth/hooks/use-auth';

const REGISTER_TIPS = [
  'Usa tu correo institucional activo.',
  'Ingresa tu documento tal como consta en tu registro.',
  'Revisa tu correo para activar la cuenta.',
];

export default function RegisterPage() {
  const router = useRouter();
  const { authSession, isHydrated } = useAuth();

  useEffect(() => {
    if (isHydrated && authSession) {
      router.replace('/dashboard');
    }
  }, [authSession, isHydrated, router]);

  return (
    <main className="register-shell">
      <section className="register-layout">
        <aside className="register-showcase">
          <div className="register-showcase-copy">
            <AppLogo />
            <h1 className="register-showcase-title">Registro institucional</h1>
            <ul className="register-tip-list">
              {REGISTER_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>

            <div className="register-showcase-media">
              <img
                alt="Imagen institucional de SafeRidePro"
                className="register-showcase-image"
                loading="eager"
                src="https://i.imgur.com/oufXJwG.png"
              />
            </div>
          </div>
        </aside>

        <div className="register-form-wrapper">
          <RegisterForm />
        </div>
      </section>
    </main>
  );
}
