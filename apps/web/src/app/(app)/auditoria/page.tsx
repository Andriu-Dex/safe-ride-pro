import { StatusPill } from '../../../components/ui/status-pill';

export default function AuditPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Auditoria</h1>
          <p className="topbar-subtitle">Vista reservada para el consumo administrativo de eventos criticos.</p>
        </div>
        <StatusPill label="Backend ya disponible" tone="success" />
      </header>

      <section className="empty-state">
        <div className="empty-state-card">
          <h2 className="panel-title">Consulta administrativa</h2>
          <p className="empty-state-text">
            El endpoint `GET /api/audit/events` ya responde. En la siguiente iteracion lo conectaremos para listar eventos reales dentro del panel.
          </p>
        </div>
      </section>
    </>
  );
}


