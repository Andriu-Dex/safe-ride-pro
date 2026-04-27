'use client';

import { AppLogo } from '../../../components/ui/app-logo';
import { RegisterForm } from './register-form';
import styles from './register-page-content.module.css';

const REGISTER_TIPS = [
  {
    title: 'Correo institucional activo',
    description: 'Usa tu correo oficial para validar tu identidad y habilitar el acceso.',
    icon: (
      <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
        <path
          d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25V6.75Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="m4.5 7 7.5 5 7.5-5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: 'Documento real y vigente',
    description: 'Registra tus datos tal como constan en tu documento para evitar rechazos.',
    icon: (
      <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
        <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 9h8M8 13h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    title: 'Activación en segundos',
    description: 'Al finalizar, te enviaremos un código para completar la verificación.',
    icon: (
      <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
        <path d="M12 7v5l3 2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
] as const;

type RegisterPageContentProps = {
  initialEmail?: string;
};

export function RegisterPageContent({ initialEmail }: RegisterPageContentProps) {
  return (
    <main
      className={`${styles.registerShell} grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#fdf8ee_0%,#f3ecdf_45%,#eadfcd_100%)] p-4 sm:p-8`}
    >
      <section className={styles.registerCard}>
        <aside className={styles.registerShowcase}>
          <div className={`${styles.registerShowcaseCopy} ${styles.entryAnimation}`}>
            <AppLogo />
            <p className={styles.kicker}>Registro institucional</p>
            <h1 className={styles.registerTitle}>Tu cuenta segura comienza aquí.</h1>
            <p className={styles.registerLead}>
              Completa el registro con datos reales y accede a una plataforma confiable para tu comunidad universitaria.
            </p>
          </div>

          <ul className={`${styles.tipList} ${styles.entryAnimation}`}>
            {REGISTER_TIPS.map((tip) => (
              <li className={styles.tipItem} key={tip.title}>
                <span className={styles.tipIcon}>{tip.icon}</span>
                <div>
                  <strong className={styles.tipTitle}>{tip.title}</strong>
                  <p className={styles.tipText}>{tip.description}</p>
                </div>
              </li>
            ))}
          </ul>

          <figure className={`${styles.mediaFrame} ${styles.entryAnimation}`}>
            <img
              alt="Imagen institucional de SafeRidePro"
              className={styles.showcaseImage}
              loading="eager"
              src="https://i.imgur.com/oufXJwG.png"
            />
          </figure>
        </aside>

        <div className={styles.registerFormPanel}>
          <RegisterForm initialEmail={initialEmail} />
        </div>
      </section>
    </main>
  );
}
