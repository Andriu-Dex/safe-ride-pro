export enum TripRequestExecutionStatus {
  AcceptedPendingBoarding = 'ACCEPTED_PENDING_BOARDING',
  OnBoard = 'ON_BOARD',
  DroppedOff = 'DROPPED_OFF',
  NoShow = 'NO_SHOW',
  CancelledBeforeBoarding = 'CANCELLED_BEFORE_BOARDING',
}

export function getEffectiveTripRequestExecutionStatus(input: {
  requestStatus: string;
  executionStatus?: TripRequestExecutionStatus | null;
}): TripRequestExecutionStatus | null {
  if (input.executionStatus) {
    return input.executionStatus;
  }

  if (input.requestStatus === 'ACCEPTED') {
    return TripRequestExecutionStatus.AcceptedPendingBoarding;
  }

  if (input.requestStatus === 'NO_SHOW') {
    return TripRequestExecutionStatus.NoShow;
  }

  return null;
}

export function isTripRequestExecutionResolved(
  executionStatus: TripRequestExecutionStatus | null,
): boolean {
  return (
    executionStatus === TripRequestExecutionStatus.DroppedOff ||
    executionStatus === TripRequestExecutionStatus.NoShow ||
    executionStatus === TripRequestExecutionStatus.CancelledBeforeBoarding
  );
}
