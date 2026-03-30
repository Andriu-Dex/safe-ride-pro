-- CreateEnum
CREATE TYPE "OperationalSanctionAppealStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'SANCTION_APPEAL_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'SANCTION_APPEAL_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'SANCTION_APPEAL_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'SANCTION_LIFTED_MANUALLY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntityType" ADD VALUE 'OPERATIONAL_SANCTION';
ALTER TYPE "AuditEntityType" ADD VALUE 'SANCTION_APPEAL';

-- CreateTable
CREATE TABLE "operational_sanction_appeals" (
    "id" TEXT NOT NULL,
    "sanctionId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "OperationalSanctionAppealStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_sanction_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operational_sanction_appeals_sanctionId_key" ON "operational_sanction_appeals"("sanctionId");

-- CreateIndex
CREATE INDEX "operational_sanction_appeals_status_createdAt_idx" ON "operational_sanction_appeals"("status", "createdAt");

-- CreateIndex
CREATE INDEX "operational_sanction_appeals_requestedByUserId_status_creat_idx" ON "operational_sanction_appeals"("requestedByUserId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "operational_sanction_appeals" ADD CONSTRAINT "operational_sanction_appeals_sanctionId_fkey" FOREIGN KEY ("sanctionId") REFERENCES "operational_sanctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_sanction_appeals" ADD CONSTRAINT "operational_sanction_appeals_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_sanction_appeals" ADD CONSTRAINT "operational_sanction_appeals_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
