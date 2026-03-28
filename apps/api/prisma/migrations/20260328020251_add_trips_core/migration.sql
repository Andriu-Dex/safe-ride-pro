-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripRouteMode" AS ENUM ('DIRECT_ROUTE', 'PLANNED_DETOUR');

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "driverMembershipId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
    "routeMode" "TripRouteMode" NOT NULL,
    "originLabel" TEXT NOT NULL,
    "destinationLabel" TEXT NOT NULL,
    "originLatitude" DOUBLE PRECISION NOT NULL,
    "originLongitude" DOUBLE PRECISION NOT NULL,
    "destinationLatitude" DOUBLE PRECISION NOT NULL,
    "destinationLongitude" DOUBLE PRECISION NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "estimatedArrivalAt" TIMESTAMP(3) NOT NULL,
    "seatCount" INTEGER NOT NULL,
    "availableSeats" INTEGER NOT NULL,
    "vehicleTypeSnapshot" "VehicleType" NOT NULL,
    "luggagePolicySnapshot" "LuggagePolicy" NOT NULL,
    "basePriceReference" DECIMAL(10,2) NOT NULL,
    "detourSurchargeReference" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "trips_institutionId_status_departureAt_idx" ON "trips"("institutionId", "status", "departureAt");

-- CreateIndex
CREATE INDEX "trips_driverMembershipId_departureAt_estimatedArrivalAt_idx" ON "trips"("driverMembershipId", "departureAt", "estimatedArrivalAt");

-- CreateIndex
CREATE INDEX "trips_vehicleId_departureAt_idx" ON "trips"("vehicleId", "departureAt");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driverMembershipId_fkey" FOREIGN KEY ("driverMembershipId") REFERENCES "user_institution_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
