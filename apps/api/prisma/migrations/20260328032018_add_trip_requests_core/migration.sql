-- CreateEnum
CREATE TYPE "TripRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "trip_requests" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "passengerMembershipId" TEXT NOT NULL,
    "status" "TripRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedPickupLatitude" DOUBLE PRECISION,
    "requestedPickupLongitude" DOUBLE PRECISION,
    "requestedDropoffLatitude" DOUBLE PRECISION,
    "requestedDropoffLongitude" DOUBLE PRECISION,
    "requestMessage" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "trip_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trip_requests_tripId_status_createdAt_idx" ON "trip_requests"("tripId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "trip_requests_passengerMembershipId_status_createdAt_idx" ON "trip_requests"("passengerMembershipId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "trip_requests_tripId_passengerMembershipId_idx" ON "trip_requests"("tripId", "passengerMembershipId");

-- AddForeignKey
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_requests" ADD CONSTRAINT "trip_requests_passengerMembershipId_fkey" FOREIGN KEY ("passengerMembershipId") REFERENCES "user_institution_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
