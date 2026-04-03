export enum UserOnboardingStatus {
  Incomplete = 'INCOMPLETE',
  Complete = 'COMPLETE',
}

export enum UserOnboardingRequirement {
  EmailVerification = 'EMAIL_VERIFICATION',
  Career = 'CAREER',
  ReferenceNeighborhood = 'REFERENCE_NEIGHBORHOOD',
  Terms = 'TERMS',
  Privacy = 'PRIVACY',
  SafetyRules = 'SAFETY_RULES',
}

export const USER_CAREER_MIN_LENGTH = 3;
export const USER_REFERENCE_NEIGHBORHOOD_MIN_LENGTH = 3;

export type UserOnboardingStateInput = {
  accountStatus?: string | null;
  globalRole?: string | null;
  emailVerifiedAt?: Date | string | null;
  career?: string | null;
  referenceNeighborhood?: string | null;
  termsAcceptedAt?: Date | string | null;
  privacyAcceptedAt?: Date | string | null;
  safetyRulesAcceptedAt?: Date | string | null;
  onboardingCompletedAt?: Date | string | null;
};

export type UserOnboardingState = {
  status: UserOnboardingStatus;
  isComplete: boolean;
  requiresOnboarding: boolean;
  missingRequirements: UserOnboardingRequirement[];
  completedAt: Date | string | null;
};

function hasTrimmedValue(value: string | null | undefined, minLength: number): boolean {
  return typeof value === 'string' && value.trim().length >= minLength;
}

export function deriveUserOnboardingState(
  input: UserOnboardingStateInput,
): UserOnboardingState {
  const missingRequirements: UserOnboardingRequirement[] = [];
  const isSuperAdmin = input.globalRole === 'SUPER_ADMIN';

  if (input.accountStatus !== 'ACTIVE' || !input.emailVerifiedAt) {
    missingRequirements.push(UserOnboardingRequirement.EmailVerification);
  }

  if (!isSuperAdmin) {
    if (!hasTrimmedValue(input.career, USER_CAREER_MIN_LENGTH)) {
      missingRequirements.push(UserOnboardingRequirement.Career);
    }

    if (
      !hasTrimmedValue(
        input.referenceNeighborhood,
        USER_REFERENCE_NEIGHBORHOOD_MIN_LENGTH,
      )
    ) {
      missingRequirements.push(UserOnboardingRequirement.ReferenceNeighborhood);
    }

    if (!input.termsAcceptedAt) {
      missingRequirements.push(UserOnboardingRequirement.Terms);
    }

    if (!input.privacyAcceptedAt) {
      missingRequirements.push(UserOnboardingRequirement.Privacy);
    }

    if (!input.safetyRulesAcceptedAt) {
      missingRequirements.push(UserOnboardingRequirement.SafetyRules);
    }
  }

  const isComplete = missingRequirements.length === 0;

  return {
    status: isComplete
      ? UserOnboardingStatus.Complete
      : UserOnboardingStatus.Incomplete,
    isComplete,
    requiresOnboarding: !isComplete,
    missingRequirements,
    completedAt: isComplete ? input.onboardingCompletedAt ?? null : null,
  };
}
