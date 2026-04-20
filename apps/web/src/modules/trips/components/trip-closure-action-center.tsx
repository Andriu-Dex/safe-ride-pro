import Link from 'next/link';

import { StatusPill } from '../../../components/ui/status-pill';

type TripClosureActionLink = {
  label: string;
  href: string;
  variant?: 'secondary' | 'ghost';
};

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
  actions: TripClosureActionLink[];
};

type TripClosureActionCenterProps = {
  title: string;
  description?: string;
  emptyTitle: string;
  emptyDescription?: string;
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
          <p className="section-label">Cierre</p>
          <h2 className="panel-title">{title}</h2>
          {description ? <p className="panel-text">{description}</p> : null}
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

              {item.windowLabel ? (
                <p className="trip-closure-window">{item.windowLabel}</p>
              ) : null}

              {item.summary ? <p className="trip-closure-summary">{item.summary}</p> : null}

              <div className="trip-closure-actions">
                {item.actions.map((action) => (
                  <Link
                    key={`${item.id}:${action.label}`}
                    className={`button ${action.variant === 'ghost' ? 'button-ghost' : 'button-secondary'}`}
                    href={action.href}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="trip-closure-empty">
          <strong>{emptyTitle}</strong>
          {emptyDescription ? <p className="panel-text">{emptyDescription}</p> : null}
        </div>
      )}
    </article>
  );
}
