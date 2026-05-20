import { Button } from '../../../components/ui/button';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import styles from './trip-request-cancel-confirmation-modal.module.css';

type TripRequestCancelConfirmationModalProps = {
  request: TripRequestRecord | null;
  isCancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function TripRequestCancelConfirmationModal({
  request,
  isCancelling,
  onClose,
  onConfirm,
}: TripRequestCancelConfirmationModalProps) {
  if (!request) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <section
        aria-labelledby="cancel-trip-request-title"
        aria-modal="true"
        className={styles.card}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <h2 className={styles.title} id="cancel-trip-request-title">
          Cancelar solicitud
        </h2>
        <p className={styles.text}>Esta seguro de que desea cancelar esta solicitud?</p>
        <strong className={styles.route}>
          {request.tripOriginLabel} -&gt; {request.tripDestinationLabel}
        </strong>
        <div className={styles.actions}>
          <Button disabled={isCancelling} onClick={onClose} type="button" variant="ghost">
            Volver
          </Button>
          <Button
            className={styles.dangerButton}
            disabled={isCancelling}
            onClick={onConfirm}
            type="button"
            variant="primary"
          >
            {isCancelling ? 'Cancelando...' : 'Cancelar solicitud'}
          </Button>
        </div>
      </section>
    </div>
  );
}
