export enum AuditAction {
  AuthRegistered = 'AUTH_REGISTERED',
  AuthEmailVerified = 'AUTH_EMAIL_VERIFIED',
  AuthLoginSucceeded = 'AUTH_LOGIN_SUCCEEDED',
  AuthLoginFailed = 'AUTH_LOGIN_FAILED',
  DriverApplicationSubmitted = 'DRIVER_APPLICATION_SUBMITTED',
  DriverApplicationApproved = 'DRIVER_APPLICATION_APPROVED',
  DriverApplicationRejected = 'DRIVER_APPLICATION_REJECTED',
  TripCreated = 'TRIP_CREATED',
  TripPublished = 'TRIP_PUBLISHED',
  TripStarted = 'TRIP_STARTED',
  TripCompleted = 'TRIP_COMPLETED',
  TripCancelled = 'TRIP_CANCELLED',
  ReportCreated = 'REPORT_CREATED',
  ReportReviewed = 'REPORT_REVIEWED',
  SanctionApplied = 'SANCTION_APPLIED',
  SanctionExpired = 'SANCTION_EXPIRED',
}

export enum AuditEntityType {
  User = 'USER',
  UserMembership = 'USER_MEMBERSHIP',
  DriverProfile = 'DRIVER_PROFILE',
  Trip = 'TRIP',
  Report = 'REPORT',
  AuthSession = 'AUTH_SESSION',
}
