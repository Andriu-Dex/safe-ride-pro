export enum GlobalUserRole {
  User = 'USER',
  SuperAdmin = 'SUPER_ADMIN',
}

export enum AccountStatus {
  PendingEmailVerification = 'PENDING_EMAIL_VERIFICATION',
  Active = 'ACTIVE',
  Suspended = 'SUSPENDED',
}

export enum InstitutionMembershipRole {
  Student = 'STUDENT',
  InstitutionAdmin = 'INSTITUTION_ADMIN',
}

export enum MembershipStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Suspended = 'SUSPENDED',
}

export enum DriverVerificationStatus {
  NotRequested = 'NOT_REQUESTED',
  PendingVerification = 'PENDING_VERIFICATION',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
  Suspended = 'SUSPENDED',
}

export enum DocumentType {
  NationalId = 'NATIONAL_ID',
  Passport = 'PASSPORT',
}

export {
  EMAIL_VERIFICATION_CODE_LENGTH,
  generateEmailVerificationCode,
} from './email-verification';

export {
  PASSWORD_RESET_CODE_LENGTH,
  generatePasswordResetCode,
} from './password-reset';

export { isValidEcuadorianNationalId } from './ecuadorian-national-id';
export { isValidEcuadorianMobilePhone } from './ecuadorian-phone';

export enum VehicleType {
  Motorcycle = 'MOTORCYCLE',
  Car = 'CAR',
  PickupTruck = 'PICKUP_TRUCK',
}

export enum LuggagePolicy {
  NotAllowed = 'NOT_ALLOWED',
  SmallOnly = 'SMALL_ONLY',
  UpToMedium = 'UP_TO_MEDIUM',
  LargeAllowed = 'LARGE_ALLOWED',
}

export enum TripRouteMode {
  DirectRoute = 'DIRECT_ROUTE',
  PlannedDetour = 'PLANNED_DETOUR',
}

export enum TripStatus {
  Draft = 'DRAFT',
  Published = 'PUBLISHED',
  Full = 'FULL',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
}

export enum TripRequestStatus {
  Pending = 'PENDING',
  Accepted = 'ACCEPTED',
  Rejected = 'REJECTED',
  Cancelled = 'CANCELLED',
  NoShow = 'NO_SHOW',
}

export {
  getEffectiveTripRequestExecutionStatus,
  isTripRequestExecutionResolved,
  TripRequestExecutionStatus,
} from './trip-request-execution';

export enum ReportStatus {
  Pending = 'PENDING',
  UnderReview = 'UNDER_REVIEW',
  Resolved = 'RESOLVED',
  Dismissed = 'DISMISSED',
}

export {
  deriveOperationalSanctionDecisions,
  doesSanctionBlockDriverOperations,
  doesSanctionBlockPassengerOperations,
  getOperationalSanctionDurationLabel,
  getOperationalSanctionScopeLabel,
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
  SANCTION_OPERATIONAL_WINDOW_DAYS,
  SANCTION_REPORTS_WINDOW_DAYS,
  SANCTION_WARNING_DURATION_DAYS,
  type OperationalSanctionDecision,
  type OperationalSanctionMetrics,
} from './operational-sanction-policy';

export {
  MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH,
  OperationalSanctionAppealStatus,
  SANCTION_APPEAL_REASON_MIN_LENGTH,
  SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH,
} from './operational-sanction-appeal';

export {
  AdministrativeRiskState,
  deriveTrustReputationProfile,
  getRecurrenceDurationMultiplier,
  SANCTION_RECURRENCE_WINDOW_DAYS,
  TRUST_LOW_RATING_THRESHOLD,
  TRUST_MIN_COMPLETED_INTERACTIONS_FOR_SIGNAL,
  TRUST_MIN_RATINGS_FOR_SIGNAL,
  VisibleReputationState,
  type ActiveOperationalSanctionLike,
  type TrustReputationInput,
  type TrustReputationProfile,
} from './trust-reputation-policy';

export {
  getReportSeverity,
  HIGH_SEVERITY_REPORT_REVIEW_MIN_NOTE_LENGTH,
  ReportSeverity,
} from './report-severity';

export {
  CancellationTiming,
  CANCELLATION_LATE_WINDOW_MINUTES,
  getCancellationTiming,
} from './cancellation-timing';

export {
  DriverLicenseStatus,
  DRIVER_LICENSE_EXPIRING_SOON_DAYS,
  getDaysUntilDriverLicenseExpiration,
  getDriverLicenseStatus,
  getEffectiveDriverVerificationStatus,
  isDriverBlockedByExpiredLicense,
  type DriverVerificationStatusLike,
} from './driver-license';

export {
  isOperationalMembership,
  selectOperationalMembership,
} from './membership-context';

export {
  deriveUserOnboardingState,
  USER_CAREER_MIN_LENGTH,
  USER_REFERENCE_NEIGHBORHOOD_MIN_LENGTH,
  UserOnboardingRequirement,
  UserOnboardingStatus,
  type UserOnboardingState,
  type UserOnboardingStateInput,
} from './user-onboarding';

export {
  getTripStartAvailability,
  TRIP_START_EARLY_WINDOW_MINUTES,
  type TripStartAvailability,
} from './trip-timing';

export {
  isTripCompletionOverdue,
  shouldAutoCancelTripForDriverAbsence,
  TRIP_COMPLETION_OVERDUE_GRACE_MINUTES,
  TRIP_DRIVER_ABSENCE_GRACE_MINUTES,
} from './trip-lifecycle';

export {
  canCreateTripIncidentReport,
  canCreateTripRating,
  deriveTripClosureIncidentType,
  getTripPostActionWindowClosesAt,
  getTripPostClosureSummary,
  isWithinTripPostActionWindow,
  TripClosureIncidentType,
  TRIP_POST_ACTION_WINDOW_HOURS,
  type TripPostClosureSummary,
} from './trip-post-closure';

export { TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH } from './trip-operation';

export {
  isTripTimeFilterValue,
  TripAvailabilityFilter,
  TRIP_TIME_FILTER_PATTERN,
} from './trip-search';

export {
  isTripPaymentClosed,
  isTripPaymentSettled,
  PaymentProvider,
  TripPaymentStatus,
} from './trip-payment';

export {
  getTripLiveTrackingSignalAgeInSeconds,
  getTripLiveTrackingSignalStatus,
  TRIP_LIVE_TRACKING_DELAYED_AFTER_SECONDS,
  TRIP_LIVE_TRACKING_OFFLINE_AFTER_SECONDS,
  TripLiveTrackingSignalStatus,
  TripLiveTrackingStatus,
} from './trip-live-tracking';

export {
  REALTIME_CONNECTED_EVENT,
  REALTIME_TRIP_LIVE_TRACKING_UPDATED_EVENT,
  REALTIME_TRIP_CHANGED_EVENT,
  REALTIME_TRIP_REQUEST_CHANGED_EVENT,
  type RealtimeConnectedEvent,
  type RealtimeEvent,
  type RealtimeTripLiveTrackingUpdatedEvent,
  type RealtimeTripChangedEvent,
  type RealtimeTripChangeReason,
  type RealtimeTripRequestChangedEvent,
  type RealtimeTripRequestChangeReason,
} from './realtime-events';
