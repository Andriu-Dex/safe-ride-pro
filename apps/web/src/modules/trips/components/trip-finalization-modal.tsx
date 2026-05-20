'use client';

import {
  isTripRequestExecutionResolved,
  TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH,
  TripRequestExecutionStatus,
} from '@saferidepro/shared-types';
import { createPortal } from 'react-dom';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { TextareaField } from '../../../components/ui/textarea-field';
import {
  getTripRequestExecutionStatusLabel,
  getTripRequestExecutionStatusTone,
  getTripRequestStatusLabel,
  getTripRequestStatusTone,
} from '../../trip-requests/lib/trip-request-labels';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import type { TripRecord } from '../types/trip';
import styles from './trip-finalization-modal.module.css';

type TripFinalizationModalProps = {
  isMutatingRequestId: string | null;
  isMutatingTripId: string | null;
  noShowNotes: Record<string, string>;
  onClose: () => void;
  onComplete: () => void;
  onMarkNoShow: (requestId: string) => void;
  onMarkPassengerBoarded: (requestId: string) => void;
  onMarkPassengerDroppedOff: (requestId: string) => void;
  onNoShowNoteChange: (requestId: string, value: string) => void;
  onTripClosureNoteChange: (tripId: string, value: string) => void;
  requestFallbackNoShowNote: string;
  requestList: TripRequestRecord[];
  trip: TripRecord | null;
  tripClosureNote: string;
};

export function TripFinalizationModal({
  isMutatingRequestId,
  isMutatingTripId,
  noShowNotes,
  onClose,
  onComplete,
  onMarkNoShow,
  onMarkPassengerBoarded,
  onMarkPassengerDroppedOff,
  onNoShowNoteChange,
  onTripClosureNoteChange,
  requestFallbackNoShowNote,
  requestList,
  trip,
  tripClosureNote,
}: TripFinalizationModalProps) {
  if (!trip || typeof document === 'undefined') {
    return null;
  }

  const unresolvedRequests = requestList.filter(
    (request) => !isTripRequestExecutionResolved(request.executionStatus),
  );
  const normalizedClosureNote = tripClosureNote.trim();
  const requiresExceptionalClosureNote = unresolvedRequests.length > 0;
  const canComplete =
    !requiresExceptionalClosureNote
    || normalizedClosureNote.length >= TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH;

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        aria-labelledby="trip-finalization-title"
        aria-modal="true"
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <p className={styles.eyebrow}>Cierre operativo</p>
          <h2 className={styles.title} id="trip-finalization-title">
            {trip.originLabel} -&gt; {trip.destinationLabel}
          </h2>
          <p className={styles.summary}>
            Antes de finalizar el viaje, marca a cada pasajero como abordado, finalizado o
            registra una ausencia cuando corresponda.
          </p>
        </div>

        <div className={styles.body}>
          {requiresExceptionalClosureNote ? (
            <div className={styles.alert}>
              <div className={styles.alertHeader}>
                <svg className={styles.alertIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <strong>Cierre excepcional requerido</strong>
              </div>
              <p>
                Aun hay {unresolvedRequests.length} pasajero
                {unresolvedRequests.length === 1 ? '' : 's'} sin cierre operativo. Si deseas
                finalizar ahora, debes registrar una nota excepcional.
              </p>
            </div>
          ) : null}

          <div className={styles.passengerList}>
            {requestList.map((request) => (
              <div key={request.id} className={styles.passengerCard}>
                <div className={styles.passengerHead}>
                  <strong>{request.passengerFullName}</strong>
                  <div className={styles.passengerMeta}>
                    <StatusPill
                      label={getTripRequestStatusLabel(request.status)}
                      tone={getTripRequestStatusTone(request.status)}
                    />
                    <StatusPill
                      label={getTripRequestExecutionStatusLabel(request.executionStatus)}
                      tone={getTripRequestExecutionStatusTone(request.executionStatus)}
                    />
                  </div>
                </div>

                {request.requestMessage ? (
                  <p className={styles.message}>{request.requestMessage}</p>
                ) : null}

                {(request.executionStatus === null
                  || request.executionStatus === TripRequestExecutionStatus.AcceptedPendingBoarding) ? (
                  <>
                    <TextareaField
                      label="Nota de ausencia"
                      onChange={(event) => onNoShowNoteChange(request.id, event.target.value)}
                      placeholder="Describe brevemente por que el pasajero no se presento."
                      rows={2}
                      value={noShowNotes[request.id] ?? requestFallbackNoShowNote}
                    />
                    <div className={styles.passengerActions}>
                      <Button
                        disabled={isMutatingRequestId === request.id}
                        onClick={() => onMarkPassengerBoarded(request.id)}
                        variant="secondary"
                      >
                        Marcar abordo
                      </Button>
                      <Button
                        disabled={isMutatingRequestId === request.id}
                        onClick={() => onMarkNoShow(request.id)}
                        variant="ghost"
                      >
                        Registrar ausencia
                      </Button>
                    </div>
                  </>
                ) : null}

                {request.executionStatus === TripRequestExecutionStatus.OnBoard ? (
                  <div className={styles.passengerActions}>
                    <Button
                      disabled={isMutatingRequestId === request.id}
                      onClick={() => onMarkPassengerDroppedOff(request.id)}
                      variant="secondary"
                    >
                      Marcar finalizado
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <TextareaField
            hint={
              requiresExceptionalClosureNote
                ? `Obligatoria para cerrar con pasajeros pendientes. Minimo ${TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH} caracteres.`
                : 'Opcional.'
            }
            label="Nota de cierre"
            onChange={(event) => onTripClosureNoteChange(trip.id, event.target.value)}
            placeholder="Describe una incidencia o razon operativa si cierras con pendientes."
            rows={3}
            value={tripClosureNote}
          />
        </div>

        <div className={styles.footer}>
          <p className={styles.footerCopy}>
            {canComplete
              ? 'El viaje ya puede cerrarse.'
              : `Debes escribir al menos ${TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH} caracteres para cerrar con pasajeros pendientes.`}
          </p>
          <div className={styles.footerActions}>
            <Button onClick={onClose} variant="ghost">
              Volver
            </Button>
            <Button
              disabled={isMutatingTripId === trip.id || !canComplete}
              onClick={onComplete}
              variant="secondary"
            >
              {requiresExceptionalClosureNote ? 'Finalizar con cierre excepcional' : 'Finalizar viaje'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
