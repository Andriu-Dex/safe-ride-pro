'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '../hooks/use-auth';
import { VerifyEmailForm } from './verify-email-form';
import styles from './verify-email-page-content.module.css';

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
    <main
      className={`${styles.verifyShell} min-h-screen bg-[radial-gradient(circle_at_top,#eefbfb_0%,#f5f7f7_44%,#edf3f2_100%)] p-4 sm:p-8`}
    >
      <section className={styles.verifyCard}>
        <header className={styles.verifyShowcase}>
          <div className={`${styles.heroBlock} ${styles.reveal}`}>
            <div className={styles.brandRow}>
              <div className={styles.mailBadge} aria-hidden="true">
                <svg fill="none" height="22" viewBox="0 0 24 24" width="22">
                  <path
                    d="M4 7.25A2.25 2.25 0 0 1 6.25 5h11.5A2.25 2.25 0 0 1 20 7.25v9.5A2.25 2.25 0 0 1 17.75 19H6.25A2.25 2.25 0 0 1 4 16.75v-9.5Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path d="m5.5 7.5 6.5 4.8 6.5-4.8" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </div>
              <p className={styles.kicker}>Activacion por correo</p>
            </div>

            <h1 className={styles.verifyTitle}>Revisa tu correo y activa tu acceso.</h1>
          </div>

          <div className={`${styles.spotlightCard} ${styles.reveal}`}>
            <div className={styles.spotlightTop}>
              <div className={styles.spotlightText}>
                <span className={styles.spotlightEyebrow}>Ruta rapida</span>
                <h2 className={styles.spotlightHeading}>Activa y entra en segundos</h2>
              </div>
              <span className={styles.pulse} aria-hidden="true" />
            </div>

            <div className={styles.spotlightSteps}>
              <article className={styles.spotlightStep}>
                <span className={styles.spotlightIndex}>1</span>
                <div>
                  <strong>Abre tu bandeja</strong>
                  <p>Busca el mensaje de confirmacion y revisa spam si aun no aparece.</p>
                </div>
              </article>
              <article className={styles.spotlightStep}>
                <span className={styles.spotlightIndex}>2</span>
                <div>
                  <strong>Copia el codigo</strong>
                  <p>Ingresa el codigo de verificacion tal como lo recibiste.</p>
                </div>
              </article>
              <article className={styles.spotlightStep}>
                <span className={styles.spotlightIndex}>3</span>
                <div>
                  <strong>Entra a tu cuenta</strong>
                  <p>Al validar el correo, el acceso queda habilitado al instante.</p>
                </div>
              </article>
            </div>
          </div>
        </header>

        <div className={styles.verifyFormPanel}>
          <VerifyEmailForm email={email} initialCode={code} />
        </div>
      </section>
    </main>
  );
}
