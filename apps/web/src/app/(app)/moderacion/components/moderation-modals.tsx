'use client';

import {
  DriverVerificationStatus,
  OperationalSanctionAppealStatus,
  ReportStatus,
} from '@saferidepro/shared-types';

import { Button } from '../../../../components/ui/button';
import { FilePreviewModal } from '../../../../components/ui/file-preview-modal';
import { StatusPill } from '../../../../components/ui/status-pill';
import { TextareaField } from '../../../../components/ui/textarea-field';
import {
  getDriverLicenseStatusLabel,
  getDriverLicenseStatusTone,
  getDriverStatusLabel,
  getDriverStatusTone,
} from '../../../../modules/driver/lib/driver-status';
import type { ReviewableDriverApplicationRecord } from '../../../../modules/driver/types/driver';
import {
  getReportReasonLabel,
  getReportSeverityLabel,
  getReportSeverityTone,
  getReportStatusLabel,
  getReportStatusTone,
  HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH,
  requiresDetailedReviewNote,
} from '../../../../modules/reports/lib/report-labels';
import type { ReportRecord } from '../../../../modules/reports/types/report';
import {
  getSanctionAppealStatusLabel,
  getSanctionAppealStatusTone,
  MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH,
  SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH,
} from '../../../../modules/sanctions/lib/sanction-labels';
import type {
  OperationalSanctionAppealRecord,
  ReviewableOperationalSanctionRecord,
} from '../../../../modules/sanctions/types/sanction';
import {
  getOperationalSanctionScopeLabel,
  getOperationalSanctionTone,
  getOperationalSanctionTypeLabel,
} from '../../../../modules/users/lib/trust-labels';
import styles from '../page.module.css';
import { InlineIcon } from './moderation-support';

export type DriverDocumentPreviewState = {
  membershipId: string;
  documentType: 'identity' | 'license';
  fileName: string;
  fileUrl: string;
  mimeType: string;
  title: string;
};

export type ReportEvidencePreviewState = {
  reportId: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  title: string;
};

type ModerationModalsProps = {
  activeDriverApplication: ReviewableDriverApplicationRecord | null;
  activeReport: ReportRecord | null;
  activeSanction: ReviewableOperationalSanctionRecord | null;
  activeAppeal: OperationalSanctionAppealRecord | null;
  driverReviewNotes: Record<string, string>;
  reviewNotes: Record<string, string>;
  sanctionLiftNotes: Record<string, string>;
  appealReviewNotes: Record<string, string>;
  isReviewingDriverMembershipId: string | null;
  isOpeningDriverDocumentKey: string | null;
  isDownloadingDriverDocumentKey: string | null;
  isReviewingReportId: string | null;
  isOpeningReportEvidenceId: string | null;
  isDownloadingReportEvidenceId: string | null;
  isLiftingSanctionId: string | null;
  isReviewingAppealId: string | null;
  driverDocumentPreview: DriverDocumentPreviewState | null;
  driverDocumentPreviewError: string | null;
  reportEvidencePreview: ReportEvidencePreviewState | null;
  reportEvidencePreviewError: string | null;
  formatDateTime: (value: string) => string;
  formatRelativeElapsed: (value: string) => string;
  getOperationalSanctionTriggerLabel: (value: string) => string;
  onCloseDriverApplication: () => void;
  onCloseReport: () => void;
  onCloseSanction: () => void;
  onCloseAppeal: () => void;
  onDriverReviewNoteChange: (membershipId: string, value: string) => void;
  onReviewNoteChange: (reportId: string, value: string) => void;
  onSanctionLiftNoteChange: (sanctionId: string, value: string) => void;
  onAppealReviewNoteChange: (appealId: string, value: string) => void;
  onOpenDriverDocumentPreview: (
    membershipId: string,
    documentType: 'identity' | 'license',
    userFullName: string,
  ) => Promise<void>;
  onDownloadDriverDocument: (
    membershipId: string,
    documentType: 'identity' | 'license',
    userFullName: string,
  ) => Promise<void>;
  onReviewDriverApplication: (
    membershipId: string,
    decision: DriverVerificationStatus.Approved | DriverVerificationStatus.Rejected,
  ) => Promise<void>;
  onOpenReportEvidencePreview: (report: ReportRecord) => Promise<void>;
  onDownloadReportEvidence: (report: ReportRecord) => Promise<void>;
  onReviewReport: (reportId: string, status: ReportStatus) => Promise<void>;
  onLiftSanction: (sanctionId: string) => Promise<void>;
  onReviewAppeal: (
    appealId: string,
    status: OperationalSanctionAppealStatus,
  ) => Promise<void>;
  resetDriverDocumentPreview: () => void;
  resetReportEvidencePreview: () => void;
  getDriverPreviewUserName: (membershipId: string) => string;
  getReportPreviewRecord: (reportId: string) => ReportRecord | undefined;
};

export function ModerationModals({
  activeDriverApplication,
  activeReport,
  activeSanction,
  activeAppeal,
  driverReviewNotes,
  reviewNotes,
  sanctionLiftNotes,
  appealReviewNotes,
  isReviewingDriverMembershipId,
  isOpeningDriverDocumentKey,
  isDownloadingDriverDocumentKey,
  isReviewingReportId,
  isOpeningReportEvidenceId,
  isDownloadingReportEvidenceId,
  isLiftingSanctionId,
  isReviewingAppealId,
  driverDocumentPreview,
  driverDocumentPreviewError,
  reportEvidencePreview,
  reportEvidencePreviewError,
  formatDateTime,
  formatRelativeElapsed,
  getOperationalSanctionTriggerLabel,
  onCloseDriverApplication,
  onCloseReport,
  onCloseSanction,
  onCloseAppeal,
  onDriverReviewNoteChange,
  onReviewNoteChange,
  onSanctionLiftNoteChange,
  onAppealReviewNoteChange,
  onOpenDriverDocumentPreview,
  onDownloadDriverDocument,
  onReviewDriverApplication,
  onOpenReportEvidencePreview,
  onDownloadReportEvidence,
  onReviewReport,
  onLiftSanction,
  onReviewAppeal,
  resetDriverDocumentPreview,
  resetReportEvidencePreview,
  getDriverPreviewUserName,
  getReportPreviewRecord,
}: ModerationModalsProps) {
  return (
    <>
      {activeDriverApplication ? (
        <div
          aria-labelledby="driver-review-modal-title"
          aria-modal="true"
          className="modal-backdrop"
          onClick={onCloseDriverApplication}
          role="dialog"
        >
          <div
            className={`modal-card modal-card-lg ${styles.modalCard}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalKicker}>Solicitud de conductor</p>
                <h2 className={styles.modalTitle} id="driver-review-modal-title">
                  {activeDriverApplication.userFullName}
                </h2>
                <p className={styles.modalSubtitle}>{activeDriverApplication.userEmail}</p>
              </div>
              <Button onClick={onCloseDriverApplication} variant="ghost">
                Cerrar
              </Button>
            </div>

            <div className={styles.modalBadgeRow}>
              <StatusPill
                label={getDriverStatusLabel(activeDriverApplication.driverVerificationStatus)}
                tone={getDriverStatusTone(activeDriverApplication.driverVerificationStatus)}
              />
              <StatusPill
                label={getDriverLicenseStatusLabel(activeDriverApplication.licenseStatus)}
                tone={getDriverLicenseStatusTone(activeDriverApplication.licenseStatus)}
              />
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Institucion</span>
                <strong className={styles.modalFieldValue}>
                  {activeDriverApplication.institutionName}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Licencia</span>
                <strong className={styles.modalFieldValue}>
                  {activeDriverApplication.licenseType.code} - {activeDriverApplication.licenseType.name}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Expira</span>
                <strong className={styles.modalFieldValue}>
                  {formatDateTime(activeDriverApplication.licenseExpiresAt)}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Enviada</span>
                <strong className={styles.modalFieldValue}>
                  {formatDateTime(activeDriverApplication.submittedAt)}
                </strong>
              </div>
            </div>

            {activeDriverApplication.reviewNotes ? (
              <div className={styles.modalNote}>
                <span className={styles.modalFieldLabel}>Nota previa</span>
                <p>{activeDriverApplication.reviewNotes}</p>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              <Button
                disabled={
                  !activeDriverApplication.identityDocumentFileKey ||
                  isOpeningDriverDocumentKey === `${activeDriverApplication.membershipId}-identity`
                }
                onClick={() =>
                  void onOpenDriverDocumentPreview(
                    activeDriverApplication.membershipId,
                    'identity',
                    activeDriverApplication.userFullName,
                  )
                }
                variant="secondary"
              >
                <span className={styles.buttonIcon}>
                  <InlineIcon className={styles.iconSmall} name="file" />
                </span>
                Ver cedula
              </Button>
              <Button
                disabled={
                  !activeDriverApplication.identityDocumentFileKey ||
                  isDownloadingDriverDocumentKey === `${activeDriverApplication.membershipId}-identity`
                }
                onClick={() =>
                  void onDownloadDriverDocument(
                    activeDriverApplication.membershipId,
                    'identity',
                    activeDriverApplication.userFullName,
                  )
                }
                variant="ghost"
              >
                Descargar
              </Button>
              <Button
                disabled={
                  !activeDriverApplication.licenseDocumentFileKey ||
                  isOpeningDriverDocumentKey === `${activeDriverApplication.membershipId}-license`
                }
                onClick={() =>
                  void onOpenDriverDocumentPreview(
                    activeDriverApplication.membershipId,
                    'license',
                    activeDriverApplication.userFullName,
                  )
                }
                variant="secondary"
              >
                <span className={styles.buttonIcon}>
                  <InlineIcon className={styles.iconSmall} name="file" />
                </span>
                Ver licencia
              </Button>
              <Button
                disabled={
                  !activeDriverApplication.licenseDocumentFileKey ||
                  isDownloadingDriverDocumentKey === `${activeDriverApplication.membershipId}-license`
                }
                onClick={() =>
                  void onDownloadDriverDocument(
                    activeDriverApplication.membershipId,
                    'license',
                    activeDriverApplication.userFullName,
                  )
                }
                variant="ghost"
              >
                Descargar
              </Button>
            </div>

            {activeDriverApplication.driverVerificationStatus !== DriverVerificationStatus.Approved ? (
              <div className={styles.modalStack}>
                <TextareaField
                  label="Nota administrativa"
                  onChange={(event) =>
                    onDriverReviewNoteChange(activeDriverApplication.membershipId, event.target.value)
                  }
                  placeholder="Motivo de aprobacion o rechazo"
                  rows={3}
                  value={driverReviewNotes[activeDriverApplication.membershipId] ?? ''}
                />
                <div className={styles.modalActions}>
                  <Button
                    disabled={isReviewingDriverMembershipId === activeDriverApplication.membershipId}
                    onClick={() =>
                      void onReviewDriverApplication(
                        activeDriverApplication.membershipId,
                        DriverVerificationStatus.Approved,
                      )
                    }
                  >
                    Aprobar solicitud
                  </Button>
                  <Button
                    disabled={
                      isReviewingDriverMembershipId === activeDriverApplication.membershipId ||
                      !(driverReviewNotes[activeDriverApplication.membershipId]?.trim())
                    }
                    onClick={() =>
                      void onReviewDriverApplication(
                        activeDriverApplication.membershipId,
                        DriverVerificationStatus.Rejected,
                      )
                    }
                    variant="ghost"
                  >
                    Rechazar solicitud
                  </Button>
                </div>
              </div>
            ) : (
              <p className={styles.modalNoteMuted}>Esta solicitud ya fue aprobada.</p>
            )}
          </div>
        </div>
      ) : null}

      {activeReport ? (
        <div
          aria-labelledby="report-review-modal-title"
          aria-modal="true"
          className="modal-backdrop"
          onClick={onCloseReport}
          role="dialog"
        >
          <div
            className={`modal-card modal-card-lg ${styles.modalCard}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalKicker}>Reporte</p>
                <h2 className={styles.modalTitle} id="report-review-modal-title">
                  {activeReport.reportedFullName}
                </h2>
                <p className={styles.modalSubtitle}>
                  {activeReport.reporterFullName} | {activeReport.institutionName}
                </p>
              </div>
              <Button onClick={onCloseReport} variant="ghost">
                Cerrar
              </Button>
            </div>

            <div className={styles.modalBadgeRow}>
              <StatusPill
                label={getReportStatusLabel(activeReport.status)}
                tone={getReportStatusTone(activeReport.status)}
              />
              <StatusPill
                label={getReportSeverityLabel(activeReport.reason)}
                tone={getReportSeverityTone(activeReport.reason)}
              />
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Motivo</span>
                <strong className={styles.modalFieldValue}>
                  {getReportReasonLabel(activeReport.reason)}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Creado</span>
                <strong className={styles.modalFieldValue}>
                  {formatDateTime(activeReport.createdAt)}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Ruta</span>
                <strong className={styles.modalFieldValue}>
                  {activeReport.tripOriginLabel} -&gt; {activeReport.tripDestinationLabel}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Antiguedad</span>
                <strong className={styles.modalFieldValue}>
                  {formatRelativeElapsed(activeReport.createdAt)}
                </strong>
              </div>
            </div>

            {activeReport.description ? (
              <div className={styles.modalNote}>
                <span className={styles.modalFieldLabel}>Descripcion</span>
                <p>{activeReport.description}</p>
              </div>
            ) : null}

            {activeReport.tripClosureNote ? (
              <div className={styles.modalNoteMuted}>
                <span className={styles.modalFieldLabel}>Nota de cierre operativo</span>
                <p>{activeReport.tripClosureNote}</p>
              </div>
            ) : null}

            <div className={styles.modalActions}>
              {activeReport.evidenceFileKey ? (
                <>
                  <Button
                    disabled={isOpeningReportEvidenceId === activeReport.id}
                    onClick={() => void onOpenReportEvidencePreview(activeReport)}
                    variant="secondary"
                  >
                    <span className={styles.buttonIcon}>
                      <InlineIcon className={styles.iconSmall} name="file" />
                    </span>
                    Ver evidencia
                  </Button>
                  <Button
                    disabled={isDownloadingReportEvidenceId === activeReport.id}
                    onClick={() => void onDownloadReportEvidence(activeReport)}
                    variant="ghost"
                  >
                    Descargar
                  </Button>
                </>
              ) : (
                <span className={styles.rowTagMuted}>Sin evidencia adjunta</span>
              )}
            </div>

            {activeReport.reviewNote ? (
              <div className={styles.modalNoteMuted}>
                <span className={styles.modalFieldLabel}>Nota previa</span>
                <p>{activeReport.reviewNote}</p>
              </div>
            ) : null}

            {activeReport.status === ReportStatus.Pending ||
            activeReport.status === ReportStatus.UnderReview ? (
              <div className={styles.modalStack}>
                <TextareaField
                  label="Nota administrativa"
                  onChange={(event) => onReviewNoteChange(activeReport.id, event.target.value)}
                  placeholder="Comentario interno o motivo de la decision"
                  rows={3}
                  value={reviewNotes[activeReport.id] ?? ''}
                />
                {requiresDetailedReviewNote(activeReport.reason) ? (
                  <p className={styles.modalNoteMuted}>
                    Minimo {HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH} caracteres para cerrar.
                  </p>
                ) : null}
                <div className={styles.modalActions}>
                  {activeReport.status === ReportStatus.Pending ? (
                    <Button
                      disabled={isReviewingReportId === activeReport.id}
                      onClick={() => void onReviewReport(activeReport.id, ReportStatus.UnderReview)}
                      variant="secondary"
                    >
                      Marcar en revision
                    </Button>
                  ) : null}
                  <Button
                    disabled={
                      isReviewingReportId === activeReport.id ||
                      !reviewNotes[activeReport.id]?.trim() ||
                      (requiresDetailedReviewNote(activeReport.reason) &&
                        (reviewNotes[activeReport.id]?.trim().length ?? 0) <
                          HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH) ||
                      (activeReport.status === ReportStatus.Pending &&
                        requiresDetailedReviewNote(activeReport.reason))
                    }
                    onClick={() => void onReviewReport(activeReport.id, ReportStatus.Resolved)}
                  >
                    Resolver
                  </Button>
                  <Button
                    disabled={
                      isReviewingReportId === activeReport.id ||
                      !reviewNotes[activeReport.id]?.trim() ||
                      (requiresDetailedReviewNote(activeReport.reason) &&
                        (reviewNotes[activeReport.id]?.trim().length ?? 0) <
                          HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH) ||
                      (activeReport.status === ReportStatus.Pending &&
                        requiresDetailedReviewNote(activeReport.reason))
                    }
                    onClick={() => void onReviewReport(activeReport.id, ReportStatus.Dismissed)}
                    variant="ghost"
                  >
                    Desestimar
                  </Button>
                </div>
              </div>
            ) : (
              <p className={styles.modalNoteMuted}>
                Cerrado por {activeReport.reviewedByFullName ?? 'administracion'}.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {activeSanction ? (
        <div
          aria-labelledby="sanction-review-modal-title"
          aria-modal="true"
          className="modal-backdrop"
          onClick={onCloseSanction}
          role="dialog"
        >
          <div
            className={`modal-card modal-card-lg ${styles.modalCard}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalKicker}>Sancion activa</p>
                <h2 className={styles.modalTitle} id="sanction-review-modal-title">
                  {activeSanction.membershipUserFullName}
                </h2>
                <p className={styles.modalSubtitle}>{activeSanction.institutionName}</p>
              </div>
              <Button onClick={onCloseSanction} variant="ghost">
                Cerrar
              </Button>
            </div>

            <div className={styles.modalBadgeRow}>
              <StatusPill
                label={getOperationalSanctionTypeLabel(activeSanction.type)}
                tone={getOperationalSanctionTone(activeSanction.type)}
              />
              <StatusPill
                label={getOperationalSanctionScopeLabel(activeSanction.scope)}
                tone="neutral"
              />
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Inicio</span>
                <strong className={styles.modalFieldValue}>
                  {formatDateTime(activeSanction.startedAt)}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Fin</span>
                <strong className={styles.modalFieldValue}>
                  {activeSanction.endsAt ? formatDateTime(activeSanction.endsAt) : 'Indefinida'}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Origen</span>
                <strong className={styles.modalFieldValue}>
                  {activeSanction.isAutomatic ? 'Automatica' : 'Manual'}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Disparador</span>
                <strong className={styles.modalFieldValue}>
                  {getOperationalSanctionTriggerLabel(activeSanction.trigger)}
                </strong>
              </div>
            </div>

            <div className={styles.modalNote}>
              <span className={styles.modalFieldLabel}>Motivo</span>
              <p>{activeSanction.reason}</p>
            </div>

            <div className={styles.modalStack}>
              <TextareaField
                label="Nota para levantar"
                onChange={(event) => onSanctionLiftNoteChange(activeSanction.id, event.target.value)}
                placeholder="Justifica por que corresponde levantar esta sancion"
                rows={3}
                value={sanctionLiftNotes[activeSanction.id] ?? ''}
              />
              <div className={styles.modalActions}>
                <Button
                  disabled={
                    isLiftingSanctionId === activeSanction.id ||
                    (sanctionLiftNotes[activeSanction.id]?.trim().length ?? 0) <
                      MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH
                  }
                  onClick={() => void onLiftSanction(activeSanction.id)}
                >
                  {isLiftingSanctionId === activeSanction.id ? 'Levantando...' : 'Levantar sancion'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeAppeal ? (
        <div
          aria-labelledby="appeal-review-modal-title"
          aria-modal="true"
          className="modal-backdrop"
          onClick={onCloseAppeal}
          role="dialog"
        >
          <div
            className={`modal-card modal-card-lg ${styles.modalCard}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalKicker}>Apelacion</p>
                <h2 className={styles.modalTitle} id="appeal-review-modal-title">
                  {activeAppeal.affectedFullName}
                </h2>
                <p className={styles.modalSubtitle}>
                  Solicita {activeAppeal.requestedByFullName}
                </p>
              </div>
              <Button onClick={onCloseAppeal} variant="ghost">
                Cerrar
              </Button>
            </div>

            <div className={styles.modalBadgeRow}>
              <StatusPill
                label={getSanctionAppealStatusLabel(activeAppeal.status)}
                tone={getSanctionAppealStatusTone(activeAppeal.status)}
              />
              <StatusPill
                label={getOperationalSanctionTypeLabel(activeAppeal.sanctionType)}
                tone={getOperationalSanctionTone(activeAppeal.sanctionType)}
              />
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Alcance</span>
                <strong className={styles.modalFieldValue}>
                  {getOperationalSanctionScopeLabel(activeAppeal.sanctionScope)}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Sancion</span>
                <strong className={styles.modalFieldValue}>
                  {activeAppeal.sanctionEndsAt
                    ? `Hasta ${formatDateTime(activeAppeal.sanctionEndsAt)}`
                    : 'Indefinida'}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Disparador</span>
                <strong className={styles.modalFieldValue}>
                  {getOperationalSanctionTriggerLabel(activeAppeal.sanctionTrigger)}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Institucion</span>
                <strong className={styles.modalFieldValue}>
                  {activeAppeal.institutionName}
                </strong>
              </div>
            </div>

            <div className={styles.modalNote}>
              <span className={styles.modalFieldLabel}>Apelacion</span>
              <p>{activeAppeal.reason}</p>
            </div>

            <div className={styles.modalNoteMuted}>
              <span className={styles.modalFieldLabel}>Sancion original</span>
              <p>{activeAppeal.sanctionReason}</p>
            </div>

            {activeAppeal.status === OperationalSanctionAppealStatus.Pending ? (
              <div className={styles.modalStack}>
                <TextareaField
                  label="Nota administrativa"
                  onChange={(event) => onAppealReviewNoteChange(activeAppeal.id, event.target.value)}
                  placeholder="Explica la decision administrativa"
                  rows={3}
                  value={appealReviewNotes[activeAppeal.id] ?? ''}
                />
                <div className={styles.modalActions}>
                  <Button
                    disabled={
                      isReviewingAppealId === activeAppeal.id ||
                      (appealReviewNotes[activeAppeal.id]?.trim().length ?? 0) <
                        SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH
                    }
                    onClick={() =>
                      void onReviewAppeal(
                        activeAppeal.id,
                        OperationalSanctionAppealStatus.Approved,
                      )
                    }
                  >
                    Aprobar apelacion
                  </Button>
                  <Button
                    disabled={
                      isReviewingAppealId === activeAppeal.id ||
                      (appealReviewNotes[activeAppeal.id]?.trim().length ?? 0) <
                        SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH
                    }
                    onClick={() =>
                      void onReviewAppeal(
                        activeAppeal.id,
                        OperationalSanctionAppealStatus.Rejected,
                      )
                    }
                    variant="ghost"
                  >
                    Rechazar apelacion
                  </Button>
                </div>
              </div>
            ) : (
              <p className={styles.modalNoteMuted}>
                Cerrada por {activeAppeal.reviewedByFullName ?? 'administracion'}.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <FilePreviewModal
        description={
          driverDocumentPreview?.mimeType?.startsWith('image/')
            ? 'Pasa el puntero sobre la imagen para ampliar los detalles del documento.'
            : 'Revisa el archivo antes de descargarlo o continuar con la revision administrativa.'
        }
        errorMessage={driverDocumentPreviewError}
        fileName={driverDocumentPreview?.fileName ?? null}
        fileUrl={driverDocumentPreview?.fileUrl ?? null}
        isDownloading={
          driverDocumentPreview
            ? isDownloadingDriverDocumentKey ===
              `${driverDocumentPreview.membershipId}-${driverDocumentPreview.documentType}`
            : false
        }
        isLoading={Boolean(isOpeningDriverDocumentKey)}
        isOpen={Boolean(driverDocumentPreview) || Boolean(driverDocumentPreviewError)}
        mimeType={driverDocumentPreview?.mimeType ?? null}
        onClose={resetDriverDocumentPreview}
        onDownload={
          driverDocumentPreview
            ? () =>
                void onDownloadDriverDocument(
                  driverDocumentPreview.membershipId,
                  driverDocumentPreview.documentType,
                  getDriverPreviewUserName(driverDocumentPreview.membershipId),
                )
            : undefined
        }
        title={driverDocumentPreview?.title ?? 'Documento del conductor'}
      />

      <FilePreviewModal
        description={
          reportEvidencePreview?.mimeType?.startsWith('image/')
            ? 'Inspecciona la imagen antes de tomar una decision administrativa sobre el caso.'
            : 'Revisa el archivo adjunto antes de cerrar o escalar el reporte.'
        }
        errorMessage={reportEvidencePreviewError}
        fileName={reportEvidencePreview?.fileName ?? null}
        fileUrl={reportEvidencePreview?.fileUrl ?? null}
        isDownloading={
          reportEvidencePreview
            ? isDownloadingReportEvidenceId === reportEvidencePreview.reportId
            : false
        }
        isLoading={Boolean(isOpeningReportEvidenceId)}
        isOpen={Boolean(reportEvidencePreview) || Boolean(reportEvidencePreviewError)}
        mimeType={reportEvidencePreview?.mimeType ?? null}
        onClose={resetReportEvidencePreview}
        onDownload={
          reportEvidencePreview
            ? () => {
                const report = getReportPreviewRecord(reportEvidencePreview.reportId);

                if (report) {
                  void onDownloadReportEvidence(report);
                }
              }
            : undefined
        }
        title={reportEvidencePreview?.title ?? 'Evidencia del reporte'}
      />
    </>
  );
}
