import { StatusPill } from '../../../components/ui/status-pill';

export default function DriverPage() {
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Conductor</h1>
          <p className="topbar-subtitle">Aqui conectaremos el estado de verificacion y la solicitud de conductor.</p>
        </div>
        <StatusPill label="Siguiente integracion" tone="warning" />
      </header>

      <section className="empty-state">
        <div className="empty-state-card">
          <h2 className="panel-title">Modulo preparado para crecer</h2>
          <p className="empty-state-text">
            La siguiente iteracion web puede conectar `GET /api/drivers/me` y `POST /api/drivers/application` sobre este espacio.
          </p>
        </div>
      </section>
    </>
  );
}

