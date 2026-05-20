import { Button } from '../../../components/ui/button';
import type { TripRecord } from '../types/trip';
import styles from './trip-delete-confirmation-modal.module.css';

type TripDeleteConfirmationModalProps = {
  trip: TripRecord | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function TripDeleteConfirmationModal({
  trip,
  isDeleting,
  onClose,
  onConfirm,
}: TripDeleteConfirmationModalProps) {
  if (!trip) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <section
        aria-labelledby="delete-draft-trip-title"
        aria-modal="true"
        className={styles.card}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={styles.iconWrapper}>
          <svg className={styles.warningIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        <div className={styles.header}>
          <h2 className={styles.title} id="delete-draft-trip-title">
            Eliminar viaje
          </h2>
          <p className={styles.lead}>¿Estás seguro de que deseas eliminar este viaje? Esta acción no se puede deshacer.</p>
        </div>

        <div className={styles.routeBox}>
          <span className={styles.routeLabel}>Detalles de la ruta</span>
          <div className={styles.routePath}>
            <div className={styles.routePoint}>
              <div className={styles.dotOrigin} />
              <span className={styles.pointLabel}>{trip.originLabel}</span>
            </div>
            <div className={styles.routeLine} />
            <div className={styles.routePoint}>
              <div className={styles.dotDestination} />
              <span className={styles.pointLabel}>{trip.destinationLabel}</span>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Button className={styles.cancelButton} disabled={isDeleting} onClick={onClose} type="button" variant="ghost">
            Cancelar
          </Button>
          <Button
            className={styles.dangerButton}
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
            variant="primary"
          >
            {isDeleting ? 'Eliminando...' : 'Sí, eliminar viaje'}
          </Button>
        </div>
      </section>
    </div>
  );
}
