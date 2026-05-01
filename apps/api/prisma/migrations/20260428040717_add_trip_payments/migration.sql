-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('DEUNA');

-- CreateEnum
CREATE TYPE "TripPaymentStatus" AS ENUM ('PENDING', 'CHECKOUT_READY', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "trip_payments" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "tripRequestId" TEXT NOT NULL,
    "passengerMembershipId" TEXT NOT NULL,
    "driverMembershipId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'DEUNA',
    "status" "TripPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "amount" DECIMAL(10,2) NOT NULL,
    "merchantOrderReference" TEXT NOT NULL,
    "providerOrderToken" TEXT,
    "providerPaymentLinkId" TEXT,
    "providerPaymentLinkUrl" TEXT,
    "providerOrderStatus" TEXT,
    "providerPaymentStatus" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_payment_attempts" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "TripPaymentStatus" NOT NULL,
    "checkoutUrl" TEXT,
    "providerOrderToken" TEXT,
    "providerPaymentLinkId" TEXT,
    "providerOrderStatus" TEXT,
    "providerPaymentStatus" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_payments_tripRequestId_key" ON "trip_payments"("tripRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "trip_payments_merchantOrderReference_key" ON "trip_payments"("merchantOrderReference");

-- CreateIndex
CREATE UNIQUE INDEX "trip_payments_providerOrderToken_key" ON "trip_payments"("providerOrderToken");

-- CreateIndex
CREATE INDEX "trip_payments_institutionId_status_createdAt_idx" ON "trip_payments"("institutionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "trip_payments_tripId_status_createdAt_idx" ON "trip_payments"("tripId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "trip_payments_passengerMembershipId_status_createdAt_idx" ON "trip_payments"("passengerMembershipId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "trip_payments_driverMembershipId_status_createdAt_idx" ON "trip_payments"("driverMembershipId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "trip_payment_attempts_paymentId_createdAt_idx" ON "trip_payment_attempts"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "trip_payment_attempts_providerOrderToken_idx" ON "trip_payment_attempts"("providerOrderToken");

-- AddForeignKey
ALTER TABLE "trip_payments" ADD CONSTRAINT "trip_payments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_payments" ADD CONSTRAINT "trip_payments_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_payments" ADD CONSTRAINT "trip_payments_tripRequestId_fkey" FOREIGN KEY ("tripRequestId") REFERENCES "trip_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_payments" ADD CONSTRAINT "trip_payments_passengerMembershipId_fkey" FOREIGN KEY ("passengerMembershipId") REFERENCES "user_institution_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_payments" ADD CONSTRAINT "trip_payments_driverMembershipId_fkey" FOREIGN KEY ("driverMembershipId") REFERENCES "user_institution_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_payment_attempts" ADD CONSTRAINT "trip_payment_attempts_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "trip_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
