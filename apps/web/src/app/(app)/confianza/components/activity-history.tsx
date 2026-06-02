import { useState } from 'react';
import { StatusPill } from '../../../../components/ui/status-pill';
import { formatDateTime } from '../utils/trust-helpers';
import { getRatingStars } from '../../../../modules/ratings/lib/rating-labels';
import {
  getReportSeverityLabel,
  getReportSeverityTone,
  getReportStatusLabel,
  getReportStatusTone,
  getReportReasonLabel,
} from '../../../../modules/reports/lib/report-labels';
import type { RatingList } from '../../../../modules/ratings/types/rating';
import type { ReportRecord } from '../../../../modules/reports/types/report';
import styles from '../styles/trust-layout.module.css';

function TrustEmptyStateCopy({ message }: { message: string }) {
  return <p className={styles.emptyCopy}>{message}</p>;
}

export function ActivityHistory({
  ratings,
  reports,
}: {
  ratings: RatingList;
  reports: ReportRecord[];
}) {
  const [activeHistoryTab, setActiveHistoryTab] = useState<'given' | 'received' | 'reports'>('given');

  return (
    <section className={styles.sectionBlock}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionHeaderTitleGroup}>
          <h2 className={styles.sectionTitle}>Registro de actividad</h2>
        </div>
      </header>

      <article className={styles.surfaceCard}>
        <nav className={styles.dashboardTabs}>
          <button
            className={[styles.dashboardTab, activeHistoryTab === 'given' ? styles.dashboardTabActive : ''].join(' ')}
            onClick={() => setActiveHistoryTab('given')}
          >
            Emitidas ({ratings.given.length})
          </button>
          <button
            className={[styles.dashboardTab, activeHistoryTab === 'received' ? styles.dashboardTabActive : ''].join(' ')}
            onClick={() => setActiveHistoryTab('received')}
          >
            Recibidas ({ratings.received.length})
          </button>
          <button
            className={[styles.dashboardTab, activeHistoryTab === 'reports' ? styles.dashboardTabActive : ''].join(' ')}
            onClick={() => setActiveHistoryTab('reports')}
          >
            Reportes ({reports.length})
          </button>
        </nav>

        <div>
          {activeHistoryTab === 'given' && (
            ratings.given.length ? (
              <div className={styles.scrollArea}>
                {ratings.given.map((rating) => (
                  <div key={rating.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <strong>{rating.targetFullName}</strong>
                      <span className={styles.inlineStars}>{getRatingStars(rating.score)} {rating.score}/5</span>
                    </div>
                    <div className={styles.tripContext}>
                      <span className={styles.tripRoute}>{rating.tripOriginLabel} &rarr; {rating.tripDestinationLabel}</span>
                      <span className={styles.tripDate}>Viaje del: {formatDateTime(rating.tripDepartureAt)}</span>
                    </div>
                    {rating.comment ? (
                      <div className={styles.incidentBox}>
                        <div className={styles.reviewBlock}>
                          <strong>Tu comentario:</strong>
                          <p>{rating.comment}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <TrustEmptyStateCopy message="Todavía no has emitido calificaciones." />
            )
          )}

          {activeHistoryTab === 'received' && (
            ratings.received.length ? (
              <div className={styles.scrollArea}>
                {ratings.received.map((rating) => (
                  <div key={rating.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <strong>{rating.authorFullName}</strong>
                      <span className={styles.inlineStars}>{getRatingStars(rating.score)} {rating.score}/5</span>
                    </div>
                    <div className={styles.tripContext}>
                      <span className={styles.tripRoute}>{rating.tripOriginLabel} &rarr; {rating.tripDestinationLabel}</span>
                      <span className={styles.tripDate}>Viaje del: {formatDateTime(rating.tripDepartureAt)}</span>
                    </div>
                    {rating.comment ? (
                      <div className={styles.incidentBox}>
                        <div className={styles.reviewBlock}>
                          <strong>Comentario recibido:</strong>
                          <p>{rating.comment}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <TrustEmptyStateCopy message="Aún no has recibido calificaciones en la membresía activa." />
            )
          )}

          {activeHistoryTab === 'reports' && (
            reports.length ? (
              <div className={styles.scrollArea}>
                {reports.map((report) => (
                  <div key={report.id} className={styles.recordCard}>
                    <div className={styles.recordHeader}>
                      <strong>{report.reportedFullName}</strong>
                      <StatusPill
                        label={getReportStatusLabel(report.status)}
                        tone={getReportStatusTone(report.status)}
                      />
                    </div>
                    <div className={styles.tripContext}>
                      <span className={styles.tripRoute}>{report.tripOriginLabel} &rarr; {report.tripDestinationLabel}</span>
                      <span className={styles.tripDate}>Emitido el: {formatDateTime(report.createdAt)}</span>
                    </div>
                    <div className={styles.incidentBox}>
                      <div className={styles.badgeRowStart}>
                        <StatusPill
                          label={getReportSeverityLabel(report.reason)}
                          tone={getReportSeverityTone(report.reason)}
                        />
                        <span className={styles.metaBadge}>{getReportReasonLabel(report.reason)}</span>
                      </div>
                      {report.description ? (
                        <div className={styles.reviewBlock}>
                          <strong>Detalle del reporte:</strong>
                          <p>{report.description}</p>
                        </div>
                      ) : null}
                    </div>
                    {report.reviewNote ? (
                      <div className={styles.reviewBlock}>
                        <strong>Respuesta administrativa:</strong>
                        <p>{report.reviewNote}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <TrustEmptyStateCopy message="Aún no has enviado reportes desde esta membresía." />
            )
          )}
        </div>
      </article>
    </section>
  );
}
