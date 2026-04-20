import { Button } from '../../../components/ui/button';

type TripsEditorialEmptyStateProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function TripsEditorialEmptyState({
  title,
  description,
  eyebrow,
  actionLabel,
  onAction,
}: TripsEditorialEmptyStateProps) {
  return (
    <article className="journey-empty-card">
      <div className="journey-empty-illustration" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="journey-empty-copy">
        {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
        <h3 className="panel-title">{title}</h3>
        {description ? <p className="panel-text">{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <div className="journey-empty-actions">
          <Button onClick={onAction} variant="secondary">
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
