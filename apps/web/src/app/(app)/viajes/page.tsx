import { StatusPill } from '../../../components/ui/status-pill';

export default function TripsPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Viajes</h1>
          <p className="topbar-subtitle">La shell ya esta lista para crear, listar y administrar viajes del conductor.</p>
        </div>
        <StatusPill label="Listo para la siguiente fase" tone="success" />
      </header>

      <section className="empty-state">
        <div className="empty-state-card">
          <h2 className="panel-title">Operacion de viajes</h2>
          <p className="empty-state-text">
            Aqui integraremos `POST /api/trips`, `GET /api/trips` y las transiciones de publicacion, inicio y cierre.
          </p>
        </div>
      </section>
    </>
  );
}


