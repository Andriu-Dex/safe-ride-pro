-- CreateEnum
CREATE TYPE "OperationalSanctionType" AS ENUM ('WARNING', 'LIMITED_PASSENGER', 'LIMITED_DRIVER', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OperationalSanctionScope" AS ENUM ('PASSENGER', 'DRIVER', 'ALL');

-- CreateEnum
CREATE TYPE "OperationalSanctionStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OperationalSanctionTrigger" AS ENUM ('PASSENGER_NO_SHOW', 'LATE_DRIVER_CANCELLATION', 'LATE_PASSENGER_CANCELLATION', 'RESOLVED_REPORTS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SANCTION_APPLIED';
ALTER TYPE "AuditAction" ADD VALUE 'SANCTION_EXPIRED';

-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'USER_MEMBERSHIP';

-- CreateTable
CREATE TABLE "operational_sanctions" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "type" "OperationalSanctionType" NOT NULL,
    "scope" "OperationalSanctionScope" NOT NULL,
    "status" "OperationalSanctionStatus" NOT NULL DEFAULT 'ACTIVE',
    "trigger" "OperationalSanctionTrigger" NOT NULL,
    "reason" TEXT NOT NULL,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_sanctions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operational_sanctions_membershipId_status_idx" ON "operational_sanctions"("membershipId", "status");

-- CreateIndex
CREATE INDEX "operational_sanctions_membershipId_scope_status_idx" ON "operational_sanctions"("membershipId", "scope", "status");

-- CreateIndex
CREATE INDEX "operational_sanctions_status_endsAt_idx" ON "operational_sanctions"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "operational_sanctions" ADD CONSTRAINT "operational_sanctions_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "user_institution_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
