import { useState } from 'react';
import { Button } from '../../../../components/ui/button';
import { StatusPill } from '../../../../components/ui/status-pill';
import { TextareaField } from '../../../../components/ui/textarea-field';
import {
  getAdministrativeRiskStateLabel,
  getAdministrativeRiskTone,
  getOperationalSanctionScopeLabel,
  getOperationalSanctionTone,
  getOperationalSanctionTypeLabel,
  getVisibleReputationStateLabel,
  getVisibleReputationTone,
} from '../../../../modules/users/lib/trust-labels';
import {
  getSanctionAppealStatusLabel,
  getSanctionAppealStatusTone,
  SANCTION_APPEAL_REASON_MIN_LENGTH,
} from '../../../../modules/sanctions/lib/sanction-labels';
import { OperationalSanctionType } from '@saferidepro/shared-types';
import type { TrustSummary } from '../../../../modules/users/types/trust-summary';
import type { OperationalSanctionAppealRecord } from '../../../../modules/sanctions/types/sanction';
import { submitSanctionAppeal } from '../../../../modules/sanctions/lib/sanction-api';
import { formatAverageScore, formatDateTime, getApiErrorMessage } from '../utils/trust-helpers';
import styles from '../styles/trust-layout.module.css';

function TrustMiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.miniMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function TrustSidebar({
  trustSummary,
  sanctionAppeals,
  authSession,
  onRefreshData,
  setErrorMessage,
  setSuccessMessage,
}: {
  trustSummary: TrustSummary;
  sanctionAppeals: OperationalSanctionAppealRecord[];
  authSession: any;
  onRefreshData: () => Promise<void>;
  setErrorMessage: (msg: string | null) => void;
  setSuccessMessage: (msg: string | null) => void;
}) {
  const [sanctionAppealDrafts, setSanctionAppealDrafts] = useState<Record<string, string>>({});
  const [isSubmittingSanctionAppealId, setIsSubmittingSanctionAppealId] = useState<string | null>(null);
  const [expandedAppealIds, setExpandedAppealIds] = useState<Set<string>>(new Set());

  const riskSignalsCount = trustSummary.riskSignals.length;
  const activeSanctionsCount = trustSummary.activeSanctions?.length ?? 0;

  const sanctionAppealsBySanctionId = new Map(
    sanctionAppeals.map((appeal) => [appeal.sanctionId, appeal])
  );

  const handleSanctionAppealDraftChange = (sanctionId: string, value: string) => {
    setSanctionAppealDrafts((currentDrafts) => ({
      ...currentDrafts,
      [sanctionId]: value,
    }));
  };

  const handleSubmitSanctionAppeal = async (sanctionId: string) => {
    if (!authSession) return;

    const reason = sanctionAppealDrafts[sanctionId]?.trim() ?? '';
    setIsSubmittingSanctionAppealId(sanctionId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await submitSanctionAppeal(authSession.accessToken, sanctionId, {
        reason,
      });

      await onRefreshData();
      setSuccessMessage(response.message);
      setSanctionAppealDrafts((currentDrafts) => ({
        ...currentDrafts,
        [sanctionId]: '',
      }));
      setExpandedAppealIds((current) => {
        const next = new Set(current);
        next.delete(sanctionId);
        return next;
      });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No fue posible enviar la apelacion.'));
    } finally {
      setIsSubmittingSanctionAppealId(null);
    }
  };

  const toggleAppealForm = (sanctionId: string) => {
    setExpandedAppealIds((current) => {
      const next = new Set(current);
      if (next.has(sanctionId)) {
        next.delete(sanctionId);
      } else {
        next.add(sanctionId);
      }
      return next;
    });
  };

  return (
    <aside className={styles.trustSidebar}>
      <article className={styles.surfaceCard}>
        <div className={styles.surfaceHeader}>
          <div>
            <h3 className={styles.surfaceTitle}>Estado</h3>
          </div>
          <div className={styles.badgeRow}>
            <StatusPill
              label={getVisibleReputationStateLabel(trustSummary.visibleReputationState)}
              tone={getVisibleReputationTone(trustSummary.visibleReputationState)}
            />
            <StatusPill
              label={getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)}
              tone={getAdministrativeRiskTone(trustSummary.administrativeRiskState)}
            />
          </div>
        </div>

        <div className={styles.miniGrid}>
          <TrustMiniMetric label="Promedio" value={formatAverageScore(trustSummary.averageRatingReceived ?? null)} />
          <TrustMiniMetric label="Ratings" value={`${trustSummary.totalRatingsReceived}`} />
          <TrustMiniMetric label="Interacciones" value={`${trustSummary.completedInteractions}`} />
          <TrustMiniMetric label="Riesgos" value={`${riskSignalsCount}`} />
          <TrustMiniMetric label="Restricciones" value={`${activeSanctionsCount}`} />
          <TrustMiniMetric label="Apelaciones" value={`${sanctionAppeals.length}`} />
        </div>
      </article>

      <article className={styles.surfaceCard}>
        <div className={styles.surfaceHeader}>
          <div>
            <h3 className={styles.surfaceTitle}>Señales</h3>
          </div>
        </div>
        {trustSummary.riskSignals.length ? (
          <ul className={styles.signalList}>
            {trustSummary.riskSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.noteText}>No se detectaron observaciones recientes.</p>
        )}
      </article>

      {trustSummary.activeSanctions && trustSummary.activeSanctions.length > 0 ? (
        <article className={styles.surfaceCard}>
          <div className={styles.surfaceHeader}>
            <div>
              <h3 className={styles.surfaceTitle}>Restricciones activas</h3>
            </div>
            <StatusPill label={`${trustSummary.activeSanctions.length} vigentes`} tone="warning" />
          </div>
          <div className={styles.stackList}>
            {trustSummary.activeSanctions.map((sanction) => {
              const linkedAppeal = sanctionAppealsBySanctionId.get(sanction.id);
              const canAppeal = sanction.type !== OperationalSanctionType.Warning;
              const appealDraft = sanctionAppealDrafts[sanction.id] ?? '';

              return (
                <div key={sanction.id} className={`${styles.recordCard} ${styles.recordCardAccent}`}>
                  <div className={styles.recordHeader}>
                    <strong>{getOperationalSanctionTypeLabel(sanction.type)}</strong>
                    <div className={styles.badgeRow}>
                      <StatusPill
                        label={getOperationalSanctionScopeLabel(sanction.scope)}
                        tone={getOperationalSanctionTone(sanction.type)}
                      />
                      {linkedAppeal ? (
                        <StatusPill
                          label={getSanctionAppealStatusLabel(linkedAppeal.status)}
                          tone={getSanctionAppealStatusTone(linkedAppeal.status)}
                        />
                      ) : null}
                    </div>
                  </div>
                  <p className={styles.noteText}>{sanction.reason}</p>
                  <p className={styles.noteText}>
                    Inicio: {formatDateTime(sanction.startedAt)}
                    {sanction.endsAt ? ` | Fin: ${formatDateTime(sanction.endsAt)}` : ''}
                  </p>

                  {linkedAppeal ? (
                    <>
                      <p className={styles.noteText}>Apelación: {linkedAppeal.reason}</p>
                      {linkedAppeal.reviewNote ? (
                        <p className={styles.noteText}>Revisión: {linkedAppeal.reviewNote}</p>
                      ) : null}
                    </>
                  ) : canAppeal ? (
                    expandedAppealIds.has(sanction.id) ? (
                      <div className={styles.appealBlock}>
                        <TextareaField
                          label="Motivo de apelación"
                          onChange={(event) =>
                            handleSanctionAppealDraftChange(sanction.id, event.target.value)
                          }
                          placeholder="Explica por qué consideras que la restricción debe revisarse"
                          rows={3}
                          value={appealDraft}
                        />
                        <p className={styles.helperText}>
                          Mínimo {SANCTION_APPEAL_REASON_MIN_LENGTH} caracteres.
                        </p>
                        <div className={styles.actionRow}>
                          <Button variant="ghost" onClick={() => toggleAppealForm(sanction.id)}>
                            Cancelar
                          </Button>
                          <Button
                            disabled={
                              isSubmittingSanctionAppealId === sanction.id ||
                              appealDraft.trim().length < SANCTION_APPEAL_REASON_MIN_LENGTH
                            }
                            onClick={() => void handleSubmitSanctionAppeal(sanction.id)}
                          >
                            {isSubmittingSanctionAppealId === sanction.id
                              ? 'Enviando apelación...'
                              : 'Enviar apelación'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.actionRow} style={{ marginTop: '0.5rem' }}>
                        <Button variant="secondary" onClick={() => toggleAppealForm(sanction.id)}>
                          Apelar restricción
                        </Button>
                      </div>
                    )
                  ) : (
                    <p className={styles.noteText}>Esta advertencia no requiere apelación.</p>
                  )}
                </div>
              );
            })}
          </div>
        </article>
      ) : null}

      {sanctionAppeals.length > 0 ? (
        <article className={styles.surfaceCard}>
          <div className={styles.surfaceHeader}>
            <div>
              <h3 className={styles.surfaceTitle}>Apelaciones</h3>
            </div>
            <StatusPill label={`${sanctionAppeals.length} registradas`} tone="neutral" />
          </div>
          <div className={styles.stackList}>
            {sanctionAppeals.map((appeal) => (
              <div key={appeal.id} className={`${styles.recordCard} ${styles.recordCardAccent}`}>
                <div className={styles.recordHeader}>
                  <strong>{getOperationalSanctionTypeLabel(appeal.sanctionType)}</strong>
                  <StatusPill
                    label={getSanctionAppealStatusLabel(appeal.status)}
                    tone={getSanctionAppealStatusTone(appeal.status)}
                  />
                </div>
                <p className={styles.noteText}>Motivo: {appeal.reason}</p>
                <p className={styles.noteText}>Registrada: {formatDateTime(appeal.createdAt)}</p>
                {appeal.reviewNote ? <p className={styles.noteText}>Revisión: {appeal.reviewNote}</p> : null}
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </aside>
  );
}
