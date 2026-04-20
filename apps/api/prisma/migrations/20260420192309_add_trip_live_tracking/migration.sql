-- CreateEnum
CREATE TYPE "TripLiveTrackingStatus" AS ENUM ('READY', 'ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "trip_live_trackings" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "status" "TripLiveTrackingStatus" NOT NULL DEFAULT 'READY',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "lastSignalAt" TIMESTAMP(3),
    "currentLatitude" DOUBLE PRECISION,
    "currentLongitude" DOUBLE PRECISION,
    "currentAccuracyMeters" DOUBLE PRECISION,
    "currentHeadingDegrees" DOUBLE PRECISION,
    "currentSpeedKph" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_live_trackings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_live_tracking_points" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyMeters" DOUBLE PRECISION,
    "headingDegrees" DOUBLE PRECISION,
    "speedKph" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_live_tracking_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_live_trackings_tripId_key" ON "trip_live_trackings"("tripId");

-- CreateIndex
CREATE INDEX "trip_live_trackings_status_lastSignalAt_idx" ON "trip_live_trackings"("status", "lastSignalAt");

-- CreateIndex
CREATE INDEX "trip_live_tracking_points_trackingId_capturedAt_idx" ON "trip_live_tracking_points"("trackingId", "capturedAt");

-- AddForeignKey
ALTER TABLE "trip_live_trackings" ADD CONSTRAINT "trip_live_trackings_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_live_tracking_points" ADD CONSTRAINT "trip_live_tracking_points_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "trip_live_trackings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
