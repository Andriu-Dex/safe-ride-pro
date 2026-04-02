ALTER TABLE "users"
ADD COLUMN "career" TEXT,
ADD COLUMN "referenceNeighborhood" TEXT,
ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "safetyRulesAcceptedAt" TIMESTAMP(3),
ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
