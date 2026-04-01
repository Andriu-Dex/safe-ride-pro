'use client';

import { AppLogo } from '../../components/ui/app-logo';
import { RegisterForm } from '../../modules/auth/components/register-form';

const REGISTER_TIPS = [
  'Usa tu correo institucional activo.',
  'Ingresa tu documento tal como consta en tu registro.',
  'Revisa tu correo para activar la cuenta.',
];

export default function RegisterPage() {
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
