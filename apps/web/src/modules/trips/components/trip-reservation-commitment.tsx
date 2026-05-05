'use client';

import { useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import type { InstitutionSettingsRecord } from '../../institutions/types/institution-settings';
import styles from './trip-reservation-commitment.module.css';

type TripReservationCommitmentProps = {
  checked: boolean;
  disabled?: boolean;
  settings: InstitutionSettingsRecord | null;
  onCheckedChange: (checked: boolean) => void;
};

export function TripReservationCommitment({
  checked,
  disabled = false,
  settings,
  onCheckedChange,
}: TripReservationCommitmentProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const ruleParagraphs = useMemo(() => {
    const body = settings?.safetyRulesBody?.trim();

    if (!body) {
      return [];
    }

    return body
      .split(/\r?\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }, [settings?.safetyRulesBody]);

  return (
    <>
      <div className={styles.commitmentBlock}>
        <label className={styles.commitmentLabel}>
          <div className={styles.checkboxRow}>
            <input
              checked={checked}
              className={styles.checkbox}
              disabled={disabled}
              onChange={(event) => onCheckedChange(event.target.checked)}
              type="checkbox"
            />
            <div className={styles.copy}>
              <strong>Confirmacion previa a la reserva</strong>
              <span>
                Acepto las reglas minimas de seguridad y las condiciones de reserva de mi
                institucion antes de enviar esta solicitud.
              </span>
            </div>
          </div>
        </label>

        <div className={styles.links}>
          <button
            className={styles.linkButton}
            onClick={() => setIsModalOpen(true)}
            type="button"
          >
            Ver reglas
          </button>
          {settings?.termsDocumentUrl ? (
            <a
              className={styles.linkAnchor}
              href={settings.termsDocumentUrl}
              rel="noreferrer"
              target="_blank"
            >
              Terminos
            </a>
          ) : (
            <span className={`${styles.linkAnchor} ${styles.disabledLink}`}>Terminos</span>
          )}
          {settings?.privacyPolicyUrl ? (
            <a
              className={styles.linkAnchor}
              href={settings.privacyPolicyUrl}
              rel="noreferrer"
              target="_blank"
            >
              Privacidad
            </a>
          ) : (
            <span className={`${styles.linkAnchor} ${styles.disabledLink}`}>Privacidad</span>
          )}
        </div>
      </div>

      {isModalOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsModalOpen(false)}
          role="presentation"
        >
          <div
            aria-labelledby="reservation-rules-title"
            aria-modal="true"
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className={styles.modalHeader}>
              <p className={styles.modalEyebrow}>Reserva segura</p>
              <h2 className={styles.modalTitle} id="reservation-rules-title">
                {settings?.safetyRulesTitle ?? 'Reglas minimas de seguridad'}
              </h2>
              <p className={styles.modalSummary}>
                {settings?.safetyRulesSummary ??
                  'Lee estas reglas antes de confirmar tu solicitud de viaje.'}
              </p>
            </div>

            <div className={styles.modalBody}>
              {ruleParagraphs.length ? (
                ruleParagraphs.map((paragraph) => (
                  <p key={paragraph} className={styles.ruleItem}>
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className={styles.ruleItem}>
                  Tu institucion aun no publico un detalle ampliado para esta reserva.
                </p>
              )}
            </div>

            <div className={styles.modalActions}>
              <Button onClick={() => setIsModalOpen(false)} variant="secondary">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
