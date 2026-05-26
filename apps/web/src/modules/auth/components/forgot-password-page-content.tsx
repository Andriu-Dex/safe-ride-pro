'use client';

import { AppLogo } from '../../../components/ui/app-logo';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../hooks/use-auth';
import { ForgotPasswordForm } from './forgot-password-form';
import styles from './forgot-password-page-content.module.css';

export function ForgotPasswordPageContent() {
  const { authSession, isHydrated, signOut } = useAuth();

  return (
    <main className={styles.forgotShell}>
      <section className={styles.forgotCard}>
        <aside className={styles.forgotShowcase}>
          <div className={styles.reveal}>
            <AppLogo />
          </div>

          <div className={styles.reveal}>
            <p className={styles.kicker}>Recuperación segura</p>
            <h1 className={styles.forgotTitle}>Recupera tu acceso sin fricción.</h1>
          </div>

          <div className={`${styles.stepList} ${styles.reveal}`}>
            <article className={styles.stepItem}>
              <span className={styles.stepIndex}>1</span>
              <div>
                <strong>Ingresa tu correo institucional</strong>
                <p>Enviaremos un código de recuperación a tu cuenta verificada.</p>
              </div>
            </article>
            <article className={styles.stepItem}>
              <span className={styles.stepIndex}>2</span>
              <div>
                <strong>Valida el código y renueva la clave</strong>
                <p>Define una nueva contraseña y recupera el acceso de inmediato.</p>
              </div>
            </article>
          </div>

          {isHydrated && authSession ? (
            <div className={`${styles.activeSessionCard} ${styles.reveal}`}>
              <p>
                Hay una sesión activa para <strong>{authSession.user.email}</strong>. Puedes recuperar otra cuenta sin redirección automática.
              </p>
              <div className={styles.activeSessionActions}>
                <Button onClick={signOut} type="button" variant="secondary">
                  Cerrar sesión actual
                </Button>
              </div>
            </div>
          ) : null}
        </aside>

        <div className={styles.forgotFormPanel}>
          <ForgotPasswordForm />
        </div>
      </section>
    </main>
  );
}
