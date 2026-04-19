import Link from 'next/link';

import { StatusPill } from '../../../components/ui/status-pill';

export type TripClosureActionItem = {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  windowLabel: string | null;
  tripStatusLabel: string;
  tripStatusTone: 'neutral' | 'success' | 'warning' | 'danger';
  incidentLabel: string | null;
  incidentTone: 'neutral' | 'success' | 'warning' | 'danger';
};

type TripClosureActionCenterProps = {
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  items: TripClosureActionItem[];
};

export function TripClosureActionCenter({
  title,
  description,
  emptyTitle,
  emptyDescription,
  items,
}: TripClosureActionCenterProps) {
  return (
    <article className="trip-closure-center">
      <div className="trip-closure-header">
        <div>
          <p className="section-label">Trip Closure Hardening</p>
          <h2 className="panel-title">{title}</h2>
          <p className="panel-text">{description}</p>
        </div>
      </div>

      {items.length ? (
        <div className="trip-closure-grid">
          {items.map((item) => (
            <div key={item.id} className="trip-closure-card">
              <div className="trip-closure-card-header">
                <div>
                  <strong>{item.title}</strong>
                  <p className="trip-closure-subtitle">{item.subtitle}</p>
                </div>
                <div className="trip-closure-pills">
                  <StatusPill label={item.tripStatusLabel} tone={item.tripStatusTone} />
                  {item.incidentLabel ? (
                    <StatusPill label={item.incidentLabel} tone={item.incidentTone} />
                  ) : null}
                </div>
              </div>

              <p className="panel-text">{item.summary}</p>
              {item.windowLabel ? (
                <p className="trip-closure-window">{item.windowLabel}</p>
              ) : null}

              <div className="trip-closure-actions">
                <Link className="button button-secondary" href="/confianza">
                  Ir a confianza
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="trip-closure-empty">
          <strong>{emptyTitle}</strong>
          <p className="panel-text">{emptyDescription}</p>
        </div>
      )}
    </article>
  );
}
