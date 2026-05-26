'use client';

import { AppLogo } from '../../../components/ui/app-logo';
import { ResetPasswordForm } from './reset-password-form';
import styles from './reset-password-page-content.module.css';

type ResetPasswordPageContentProps = {
  code?: string;
  email?: string;
  sent?: boolean;
};

export function ResetPasswordPageContent({
  code,
  email,
  sent = false,
}: ResetPasswordPageContentProps) {
  return (
    <main className={styles.resetShell}>
      <section className={styles.resetCard}>
        <aside className={styles.resetShowcase}>
          <div className={styles.reveal}>
            <AppLogo />
          </div>

          <div className={styles.reveal}>
            <p className={styles.kicker}>Clave renovada</p>
            <h1 className={styles.resetTitle}>Blindemos tu cuenta con una nueva clave.</h1>
            <p className={styles.resetLead}>
              Ingresa el código recibido y crea una contraseña robusta para retomar el acceso de inmediato.
            </p>
          </div>

          <div className={`${styles.highlightStrip} ${styles.reveal}`}>
            <article className={styles.highlightChip}>
              <strong>01 código</strong>
              <span>Validación temporal por correo</span>
            </article>
            <article className={styles.highlightChip}>
              <strong>08+ caracteres</strong>
              <span>Clave mínima recomendada</span>
            </article>
            <article className={styles.highlightChip}>
              <strong>90 seg</strong>
              <span>Tiempo promedio de actualización</span>
            </article>
          </div>

          <div className={`${styles.stepGrid} ${styles.reveal}`}>
            <article className={styles.stepCard}>
              <span className={styles.stepIndex}>1</span>
              <div>
                <strong>Copia el código del correo</strong>
                <p>Verifica bandeja principal, spam o promociones antes de reenviar.</p>
              </div>
            </article>
            <article className={styles.stepCard}>
              <span className={styles.stepIndex}>2</span>
              <div>
                <strong>Define una contraseña más fuerte</strong>
                <p>Combina letras, números y símbolos para una protección superior.</p>
              </div>
            </article>
          </div>
        </aside>

        <div className={styles.resetFormPanel}>
          <ResetPasswordForm email={email} initialCode={code} showSentMessage={sent} />
        </div>
      </section>
    </main>
  );
}
