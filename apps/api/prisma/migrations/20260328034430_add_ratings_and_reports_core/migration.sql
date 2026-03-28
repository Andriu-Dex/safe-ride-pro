-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "authorMembershipId" TEXT NOT NULL,
    "targetMembershipId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "reporterMembershipId" TEXT NOT NULL,
    "reportedMembershipId" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "evidenceFileKey" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ratings_authorMembershipId_createdAt_idx" ON "ratings"("authorMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "ratings_targetMembershipId_createdAt_idx" ON "ratings"("targetMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "ratings_tripId_createdAt_idx" ON "ratings"("tripId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_tripId_authorMembershipId_targetMembershipId_key" ON "ratings"("tripId", "authorMembershipId", "targetMembershipId");

-- CreateIndex
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "reports_reporterMembershipId_createdAt_idx" ON "reports"("reporterMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "reports_reportedMembershipId_createdAt_idx" ON "reports"("reportedMembershipId", "createdAt");

-- CreateIndex
CREATE INDEX "reports_tripId_createdAt_idx" ON "reports"("tripId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reports_tripId_reporterMembershipId_reportedMembershipId_key" ON "reports"("tripId", "reporterMembershipId", "reportedMembershipId");

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "user_institution_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_targetMembershipId_fkey" FOREIGN KEY ("targetMembershipId") REFERENCES "user_institution_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterMembershipId_fkey" FOREIGN KEY ("reporterMembershipId") REFERENCES "user_institution_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reportedMembershipId_fkey" FOREIGN KEY ("reportedMembershipId") REFERENCES "user_institution_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
