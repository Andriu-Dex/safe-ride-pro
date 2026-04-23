'use client';

import { LoginForm } from './login-form';
import styles from './login-page-content.module.css';

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
    <main className={`${styles.loginShell} min-h-screen bg-slate-100 p-4 sm:p-8`}>
      <section className={styles.loginCard}>
        <div className={styles.loginShowcase}>
          <img
            alt="Logo de SafeRidePro"
            className={styles.authHeroLogo}
            loading="eager"
            src="https://i.imgur.com/7UUGKrJ.png"
          />
          <div>
            <p className={styles.kicker}>Acceso web</p>
            <h1 className={styles.heroTitle}>Bienvenido a SafeRidePro.</h1>
          </div>

          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <strong>Acceso institucional seguro</strong>
              <p>Tu cuenta se verifica por correo y se mantiene activa con renovacion controlada de sesion.</p>
            </div>
          </div>
        </div>

        <div className={styles.loginFormPanel}>
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
