import { InfoCard } from '../../../components/ui/info-card';
import { StatusPill } from '../../../components/ui/status-pill';

export default function DashboardPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Panel principal</h1>
          <p className="topbar-subtitle">
            Estado actual del MVP web conectado al backend de SafeRidePro.
          </p>
        </div>
        <div className="topbar-actions">
          <span className="topbar-badge">Sesion protegida</span>
          <StatusPill label="API conectada" tone="success" />
        </div>
      </header>

      <section className="content-grid">
        <div className="metrics-grid">
          <InfoCard
            description="El panel ya consume login real y valida sesiones desde /api/users/me."
            label="Autenticacion"
            value="Operativa"
          />
          <InfoCard
            description="La siguiente integracion recomendada es conductor y vehiculos para cerrar el onboarding."
            label="Siguiente bloque"
            value="Onboarding"
          />
          <InfoCard
            description="La auditoria administrativa ya puede consultarse con credenciales validas."
            label="Auditoria"
            value="Disponible"
          />
        </div>

        <div className="page-grid">
          <article className="panel panel-stack">
            <StatusPill label="Fase actual" tone="warning" />
            <h2 className="panel-title">Integracion web del MVP</h2>
            <p className="panel-text">
              Ya completamos la puerta de entrada al sistema. A partir de esta base, cada modulo nuevo se puede colgar de la misma sesion autenticada.
            </p>
          </article>

          <article className="panel panel-stack">
            <StatusPill label="Patron aplicado" tone="neutral" />
            <h2 className="panel-title">Variables y componentes</h2>
            <p className="panel-text">
              La interfaz ya usa variables globales de estilo y componentes reutilizables para mantener consistencia sin sobreingenieria.
            </p>
          </article>

          <article className="panel panel-stack">
            <StatusPill label="Proximo objetivo" tone="success" />
            <h2 className="panel-title">Flujo operativo</h2>
            <p className="panel-text">
              Lo mas eficiente ahora es conectar estado de conductor, registro de vehiculos y creacion de viajes desde la web.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}

