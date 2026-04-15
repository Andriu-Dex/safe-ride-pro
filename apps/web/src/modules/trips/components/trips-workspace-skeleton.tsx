type TripsWorkspaceSkeletonVariant = 'operation' | 'requests' | 'discover';

type TripsWorkspaceSkeletonProps = {
  variant: TripsWorkspaceSkeletonVariant;
};

export function TripsWorkspaceSkeleton({ variant }: TripsWorkspaceSkeletonProps) {
  const cardCount = variant === 'discover' ? 3 : 2;

  return (
    <section className="journey-skeleton-grid" aria-hidden="true">
      {Array.from({ length: cardCount }).map((_, index) => (
        <article className="journey-skeleton-card" key={`${variant}-${index + 1}`}>
          <div className="journey-skeleton-line journey-skeleton-line-title" />
          <div className="journey-skeleton-line journey-skeleton-line-meta" />
          <div className="journey-skeleton-line" />
          <div className="journey-skeleton-line" />
          <div className="journey-skeleton-line journey-skeleton-line-short" />
        </article>
      ))}
    </section>
  );
}
