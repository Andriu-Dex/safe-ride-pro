-- AlterEnum
ALTER TYPE "TripRequestStatus" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "cancelledAt" TIMESTAMP(3);
