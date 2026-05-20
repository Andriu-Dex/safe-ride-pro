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
          <p className={styles.lead}>Esta seguro de que desea eliminar este viaje?</p>
        </div>

        <div className={styles.routeBox}>
          <span>Ruta</span>
          <strong>{trip.originLabel} -&gt; {trip.destinationLabel}</strong>
        </div>

        <div className={styles.actions}>
          <Button disabled={isDeleting} onClick={onClose} type="button" variant="ghost">
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
