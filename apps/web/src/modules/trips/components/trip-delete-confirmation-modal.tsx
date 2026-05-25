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
        <div className={styles.header}>
          <h2 className={styles.title} id="delete-draft-trip-title">
            Eliminar viaje
          </h2>
          <p className={styles.lead}>¿Estás seguro de que deseas eliminar este viaje? Esta acción no se puede deshacer.</p>
        </div>

        <div className={styles.routeBox}>
          <span className={styles.routeLabel}>Ruta a eliminar</span>
          <strong>{trip.originLabel} &rarr; {trip.destinationLabel}</strong>
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
            {isDeleting ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </div>
      </section>
    </div>
  );
}
