type OperationalAccessCardProps = Readonly<{
  title: string;
  message: string;
}>;

export function OperationalAccessCard({
  title,
  message,
}: OperationalAccessCardProps) {
  return (
    <div className="empty-state-card operational-access-card">
      <p className="sidebar-label operational-access-kicker">Acceso operativo restringido</p>
      <h2 className="panel-title">{title}</h2>
      <p className="empty-state-text">{message}</p>
    </div>
  );
}
