import { AppLogo } from '../../components/ui/app-logo';
import { ResetPasswordForm } from '../../modules/auth/components/reset-password-form';

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    code?: string | string[];
    email?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const code = getSingleSearchParam(resolvedSearchParams.code);
  const email = getSingleSearchParam(resolvedSearchParams.email);

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-showcase">
          <AppLogo />
          <div>
            <p className="kicker">Nueva contrasena</p>
            <h1 className="hero-title">Protege tu cuenta.</h1>
          </div>
          <p className="hero-text">
            Usa el codigo recibido para definir una nueva contrasena y continuar con seguridad.
          </p>
        </div>

        <div className="login-form-panel">
          <ResetPasswordForm email={email} initialCode={code} />
        </div>
      </section>
    </main>
  );
}
