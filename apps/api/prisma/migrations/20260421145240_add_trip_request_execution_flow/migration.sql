-- CreateEnum
CREATE TYPE "TripRequestExecutionStatus" AS ENUM ('ACCEPTED_PENDING_BOARDING', 'ON_BOARD', 'DROPPED_OFF', 'NO_SHOW', 'CANCELLED_BEFORE_BOARDING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'TRIP_PASSENGER_BOARDED';
ALTER TYPE "AuditAction" ADD VALUE 'TRIP_PASSENGER_DROPPED_OFF';

-- AlterTable
ALTER TABLE "trip_requests" ADD COLUMN     "boardedAt" TIMESTAMP(3),
ADD COLUMN     "droppedOffAt" TIMESTAMP(3),
ADD COLUMN     "executionStatus" "TripRequestExecutionStatus",
ADD COLUMN     "executionStatusUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "trip_requests_tripId_executionStatus_createdAt_idx" ON "trip_requests"("tripId", "executionStatus", "createdAt");
