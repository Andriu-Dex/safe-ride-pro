type HomePageProps = {
  searchParams?: Promise<{
    verified?: string | string[];
    email?: string | string[];
  }>;
};

function getSingleSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const verified = getSingleSearchParam(resolvedSearchParams.verified) === '1';
  const email = getSingleSearchParam(resolvedSearchParams.email);
  const loginHref = email
    ? `/login?email=${encodeURIComponent(email)}&verified=1`
    : verified
      ? '/login?verified=1'
      : '/login';

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
            <p className="kicker">Bienvenida a la pagina</p>
            <h1 className="hero-title">Tu comunidad universitaria ya tiene un acceso seguro.</h1>
          </div>
          <p className="hero-text">
            SafeRidePro conecta estudiantes, conductores y administradores con una experiencia
            mas clara, segura y profesional.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <strong>Registro institucional verificado</strong>
              <p>Usa tu correo universitario para activar tu cuenta y continuar con confianza.</p>
            </div>
            <div className="feature-item">
              <strong>Movilidad mas ordenada</strong>
              <p>Gestiona viajes, confianza y auditoria desde una misma plataforma.</p>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="form-card">
            <div className="form-header">
              <p className="kicker">Acceso principal</p>
              <h2>Bienvenido a SafeRidePro</h2>
              <p>Inicia sesión o crea tu cuenta para comenzar a usar la plataforma.</p>
            </div>

            {verified ? (
              <div className="form-success">
                Correo verificado correctamente. Ya puedes iniciar sesión.
              </div>
            ) : null}

            <div className="button-row">
              <a className="button button-primary" href={loginHref}>
                Iniciar sesión
              </a>
              <a className="button button-secondary" href="/register">
                Crear cuenta
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

