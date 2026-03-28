-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('AUTH_REGISTERED', 'AUTH_EMAIL_VERIFIED', 'AUTH_LOGIN_SUCCEEDED', 'AUTH_LOGIN_FAILED', 'DRIVER_APPLICATION_SUBMITTED', 'DRIVER_APPLICATION_APPROVED', 'DRIVER_APPLICATION_REJECTED', 'TRIP_CREATED', 'TRIP_PUBLISHED', 'TRIP_STARTED', 'TRIP_COMPLETED', 'TRIP_CANCELLED', 'REPORT_CREATED', 'REPORT_REVIEWED');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('USER', 'DRIVER_PROFILE', 'TRIP', 'REPORT', 'AUTH_SESSION');

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_institutionId_createdAt_idx" ON "audit_events"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_actorUserId_createdAt_idx" ON "audit_events"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_action_createdAt_idx" ON "audit_events"("action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_createdAt_idx" ON "audit_events"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
