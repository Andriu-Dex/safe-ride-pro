export enum OperationalSanctionAppealStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
}

export const SANCTION_APPEAL_REASON_MIN_LENGTH = 20;
export const SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH = 15;
export const MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH = 15;
