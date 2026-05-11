'use client';

import styles from '../page.module.css';

export type ModerationWorkspaceSection =
  | 'driver'
  | 'reports'
  | 'sanctions'
  | 'appeals';

type IconName =
  | 'driver'
  | 'report'
  | 'sanction'
  | 'appeal'
  | 'refresh'
  | 'review'
  | 'file'
  | 'detail';

export function InlineIcon({ name, className }: { name: IconName; className?: string }) {
  const iconProps = {
    className: className ?? styles.icon,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'driver':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M4.5 12h3" />
          <path d="M16.5 12h3" />
        </svg>
      );
    case 'report':
      return (
        <svg {...iconProps}>
          <path d="M12 3l9 16H3l9-16z" />
          <path d="M12 9v4" />
          <circle cx="12" cy="17" r="1" />
        </svg>
      );
    case 'sanction':
      return (
        <svg {...iconProps}>
          <path d="M2 21h7" />
          <path d="M6 13l5-5" />
          <path d="M8 15l4 4" />
          <path d="M12 6l4 4" />
          <path d="M13 5l4 4" />
        </svg>
      );
    case 'appeal':
      return (
        <svg {...iconProps}>
          <path d="M4 5h16a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9l-5 4v-4H4a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...iconProps}>
          <path d="M20 6v6h-6" />
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        </svg>
      );
    case 'review':
      return (
        <svg {...iconProps}>
          <path d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'file':
      return (
        <svg {...iconProps}>
          <path d="M6 3h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M13 3v5h5" />
        </svg>
      );
    case 'detail':
      return (
        <svg {...iconProps}>
          <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    default:
      return null;
  }
}

export function StatChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statCardLabel}>{label}</span>
      <strong className={styles.statCardValue}>{value}</strong>
    </div>
  );
}
