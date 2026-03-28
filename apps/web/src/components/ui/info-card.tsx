type InfoCardProps = {
  label: string;
  value: string;
  description: string;
  muted?: boolean;
};

export function InfoCard({ label, value, description, muted = false }: InfoCardProps) {
  return (
    <article className={['info-card', muted ? 'info-card-muted' : ''].filter(Boolean).join(' ')}>
      <p className="info-card-label">{label}</p>
      <h3 className="info-card-value">{value}</h3>
      <p className="info-card-description">{description}</p>
    </article>
  );
}

