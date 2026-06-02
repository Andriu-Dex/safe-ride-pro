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
                  <div key={rating.id} className={styles.historyCard}>
                    <div className={styles.historyHeader}>
                      <div className={styles.historyTitle}>
                        {rating.targetFullName}
                        <span className={styles.inlineStars} style={{ fontSize: '1.1rem', marginLeft: '0.4rem' }}>
                          {getRatingStars(rating.score)}
                        </span>
                      </div>
                      <span className={styles.historyMeta}>
                        {rating.tripOriginLabel} &rarr; {rating.tripDestinationLabel} &bull; {formatDateTime(rating.tripDepartureAt)}
                      </span>
                    </div>
                    {rating.comment ? (
                      <p className={styles.historyComment}>{rating.comment}</p>
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
                  <div key={rating.id} className={styles.historyCard}>
                    <div className={styles.historyHeader}>
                      <div className={styles.historyTitle}>
                        {rating.authorFullName}
                        <span className={styles.inlineStars} style={{ fontSize: '1.1rem', marginLeft: '0.4rem' }}>
                          {getRatingStars(rating.score)}
                        </span>
                      </div>
                      <span className={styles.historyMeta}>
                        {rating.tripOriginLabel} &rarr; {rating.tripDestinationLabel} &bull; {formatDateTime(rating.tripDepartureAt)}
                      </span>
                    </div>
                    {rating.comment ? (
                      <p className={styles.historyComment}>{rating.comment}</p>
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
                {reports.map((report) => {
                  const tone = getReportSeverityTone(report.reason);
                  let severityClass = styles.severityLow;
                  if (tone === 'warning') severityClass = styles.severityMedium;
                  if (tone === 'danger') severityClass = styles.severityHigh;

                  return (
                    <div key={report.id} className={styles.historyCard}>
                      <div className={styles.historyHeader}>
                        <div className={styles.historyTitle}>
                          <span
                            aria-hidden="true"
                            className={`${styles.severityDot} ${severityClass}`}
                            title={getReportSeverityLabel(report.reason)}
                          />
                          <span className="sr-only">{getReportSeverityLabel(report.reason)}.</span>
                          {report.reportedFullName}
                          <span style={{ fontSize: '0.85rem', color: '#526b78', fontWeight: 600, marginLeft: '0.5rem' }}>
                            ({getReportReasonLabel(report.reason)})
                          </span>
                        </div>
                        <StatusPill
                          label={getReportStatusLabel(report.status)}
                          tone={getReportStatusTone(report.status)}
                        />
                      </div>
                      <div className={styles.historyMeta} style={{ marginBottom: '0.2rem' }}>
                        {report.tripOriginLabel} &rarr; {report.tripDestinationLabel} &bull; Emitido: {formatDateTime(report.createdAt)}
                      </div>
                      {report.description ? (
                        <p className={styles.historyComment} style={{ color: '#0b1c30' }}>
                          <strong>Tú:</strong> {report.description}
                        </p>
                      ) : null}
                      {report.reviewNote ? (
                        <p className={styles.historyComment} style={{ marginTop: '0.2rem' }}>
                          <strong>Soporte:</strong> {report.reviewNote}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
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
