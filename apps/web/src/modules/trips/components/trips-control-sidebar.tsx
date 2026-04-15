import Link from 'next/link';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';

export type TripsWorkspaceSection = 'operation' | 'requests' | 'discover';

export type TripsWorkspaceOption = {
  id: TripsWorkspaceSection;
  label: string;
  description: string;
  metric: string;
};

export type TripsReadinessItemTone = 'success' | 'warning';

export type TripsReadinessItem = {
  id: string;
  label: string;
  detail: string;
  tone: TripsReadinessItemTone;
};

type TripsControlSidebarProps = {
  activeWorkspace: TripsWorkspaceSection;
  onWorkspaceChange: (workspace: TripsWorkspaceSection) => void;
  workspaceOptions: TripsWorkspaceOption[];
  canCreateTrips: boolean;
  onCreateTrip: () => void;
  onDiscoverTrips: () => void;
  readinessCompletion: number;
  readinessItems: TripsReadinessItem[];
};

export function TripsControlSidebar({
  activeWorkspace,
  onWorkspaceChange,
  workspaceOptions,
  canCreateTrips,
  onCreateTrip,
  onDiscoverTrips,
  readinessCompletion,
  readinessItems,
}: TripsControlSidebarProps) {
  return (
    <aside className="journey-sidebar panel panel-stack">
      <div className="journey-sidebar-section">
        <p className="section-label">Workspace</p>
        <h2 className="panel-title">Navegacion</h2>
        <p className="panel-text">Cada flujo vive en un panel dedicado para evitar ruido visual.</p>
      </div>

      <nav aria-label="Secciones de viajes" className="journey-workspace-nav">
        {workspaceOptions.map((workspace) => (
          <button
            key={workspace.id}
            aria-pressed={activeWorkspace === workspace.id}
            className={[
              'journey-workspace-button',
              activeWorkspace === workspace.id ? 'journey-workspace-button-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onWorkspaceChange(workspace.id)}
            type="button"
          >
            <span>{workspace.label}</span>
            <small>{workspace.metric}</small>
            <p>{workspace.description}</p>
          </button>
        ))}
      </nav>

      <div className="journey-sidebar-section">
        <p className="section-label">Atajos</p>
        <div className="journey-quick-actions">
          <Button disabled={!canCreateTrips} onClick={onCreateTrip}>
            Nuevo viaje
          </Button>
          <Button onClick={onDiscoverTrips} variant="secondary">
            Buscar cupos
          </Button>
        </div>
      </div>

      <article className="journey-readiness">
        <div className="journey-readiness-header">
          <p className="section-label">Estado operacional</p>
          <strong>{readinessCompletion}% listo</strong>
        </div>
        <ul className="journey-readiness-list">
          {readinessItems.map((item) => (
            <li key={item.id} className="journey-readiness-item">
              <StatusPill
                label={item.tone === 'success' ? 'Listo' : 'Pendiente'}
                tone={item.tone === 'success' ? 'success' : 'warning'}
              />
              <div>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        {!canCreateTrips ? (
          <div className="journey-readiness-actions">
            <Link className="journey-inline-link" href="/conductor">
              Revisar perfil de conductor
            </Link>
            <Link className="journey-inline-link" href="/vehiculos">
              Gestionar vehiculos
            </Link>
          </div>
        ) : null}
      </article>
    </aside>
  );
}
