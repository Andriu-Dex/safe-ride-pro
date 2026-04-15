'use client';

import { AppLogo } from '../../components/ui/app-logo';
import { Button } from '../../components/ui/button';
import { ForgotPasswordForm } from '../../modules/auth/components/forgot-password-form';
import { useAuth } from '../../modules/auth/hooks/use-auth';

export default function ForgotPasswordPage() {
  const { authSession, isHydrated, signOut } = useAuth();

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

          {isHydrated && authSession ? (
            <div className="form-helper form-helper-strong">
              <p>
                Hay una sesion activa para <strong>{authSession.user.email}</strong>, pero puedes
                recuperar el acceso de otra cuenta sin que el sistema te redirija automaticamente.
              </p>
              <div className="button-row">
                <Button onClick={signOut} type="button" variant="secondary">
                  Cerrar sesion actual
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="login-form-panel">
          <ForgotPasswordForm />
        </div>
      </section>
    </main>
  );
}
