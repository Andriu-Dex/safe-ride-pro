'use client';

import { LoginForm } from './login-form';

type LoginPageContentProps = {
  nextPath?: string;
  initialEmail?: string;
  showVerifiedMessage?: boolean;
  showResetMessage?: boolean;
};

export function LoginPageContent({
  nextPath = '/inicio',
  initialEmail,
  showVerifiedMessage = false,
  showResetMessage = false,
}: LoginPageContentProps) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-showcase">
          <img
            alt="Logo de SafeRidePro"
            className="auth-hero-logo"
            loading="eager"
            src="https://i.imgur.com/7UUGKrJ.png"
          />
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
