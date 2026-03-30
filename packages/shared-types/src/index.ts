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
  getTripStartAvailability,
  TRIP_START_EARLY_WINDOW_MINUTES,
  type TripStartAvailability,
} from './trip-timing';
