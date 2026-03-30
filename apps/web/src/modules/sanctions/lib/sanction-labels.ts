import {
  MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH,
  OperationalSanctionAppealStatus,
  SANCTION_APPEAL_REASON_MIN_LENGTH,
  SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH,
} from '@saferidepro/shared-types';

export function getSanctionAppealStatusLabel(
  status: OperationalSanctionAppealStatus,
): string {
  switch (status) {
    case OperationalSanctionAppealStatus.Pending:
      return 'Pendiente';
    case OperationalSanctionAppealStatus.Approved:
      return 'Aprobada';
    case OperationalSanctionAppealStatus.Rejected:
      return 'Rechazada';
    default:
      return status;
  }
}

export function getSanctionAppealStatusTone(
  status: OperationalSanctionAppealStatus,
): 'warning' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case OperationalSanctionAppealStatus.Pending:
      return 'warning';
    case OperationalSanctionAppealStatus.Approved:
      return 'success';
    case OperationalSanctionAppealStatus.Rejected:
      return 'danger';
    default:
      return 'neutral';
  }
}

export {
  MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH,
  SANCTION_APPEAL_REASON_MIN_LENGTH,
  SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH,
};
