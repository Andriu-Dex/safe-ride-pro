ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'CASH';

CREATE TYPE "AppNotificationType" AS ENUM (
  'TRIP_REQUEST_CREATED',
  'TRIP_REQUEST_ACCEPTED',
  'TRIP_REQUEST_REJECTED',
  'TRIP_REQUEST_CANCELLED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_ACTION_REQUIRED',
  'CASH_PAYMENT_REPORTED',
  'RATING_PENDING',
  'TRUST_ACTION',
  'DRIVER_APPLICATION_UPDATED',
  'SYSTEM'
);

CREATE TABLE "app_notifications" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "recipientMembershipId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "type" "AppNotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "actionUrl" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_notifications_recipientMembershipId_readAt_createdAt_idx"
  ON "app_notifications"("recipientMembershipId", "readAt", "createdAt");

CREATE INDEX "app_notifications_institutionId_createdAt_idx"
  ON "app_notifications"("institutionId", "createdAt");

ALTER TABLE "app_notifications"
  ADD CONSTRAINT "app_notifications_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_notifications"
  ADD CONSTRAINT "app_notifications_recipientMembershipId_fkey"
  FOREIGN KEY ("recipientMembershipId") REFERENCES "user_institution_memberships"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "app_notifications"
  ADD CONSTRAINT "app_notifications_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
