import { StatusPill } from '../../../components/ui/status-pill';

export default function VehiclesPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Vehiculos</h1>
          <p className="topbar-subtitle">Base visual lista para enlazar catalogos, registro y listado de vehiculos.</p>
        </div>
        <StatusPill label="Pendiente de conectar" tone="warning" />
      </header>

      <section className="empty-state">
        <div className="empty-state-card">
          <h2 className="panel-title">Registro de vehiculos</h2>
          <p className="empty-state-text">
            En la siguiente fase podremos consumir `GET /api/vehicles/me`, catalogos y `POST /api/vehicles` desde esta vista.
          </p>
        </div>
      </section>
    </>
  );
}

