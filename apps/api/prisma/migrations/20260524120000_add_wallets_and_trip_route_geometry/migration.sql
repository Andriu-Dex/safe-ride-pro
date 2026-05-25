ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'WALLET';

CREATE TYPE "WalletLedgerEntryType" AS ENUM (
  'TOP_UP_CAPTURED',
  'HOLD_CREATED',
  'HOLD_RELEASED',
  'HOLD_CAPTURED',
  'REFUND_CREDIT'
);

CREATE TYPE "WalletTopUpStatus" AS ENUM (
  'PENDING',
  'CHECKOUT_READY',
  'PROCESSING',
  'PAID',
  'FAILED',
  'CANCELLED',
  'EXPIRED'
);

ALTER TABLE "institution_settings"
  ADD COLUMN "allowWalletPayments" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "trips"
  ADD COLUMN "routePath" JSONB,
  ADD COLUMN "routeDistanceMeters" INTEGER,
  ADD COLUMN "routeDurationSeconds" INTEGER;

CREATE TABLE "wallet_accounts" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'USD',
  "availableBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "heldBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_top_ups" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'PAYPAL',
  "status" "WalletTopUpStatus" NOT NULL DEFAULT 'PENDING',
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

  CONSTRAINT "wallet_top_ups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "wallet_ledger_entries" (
  "id" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "type" "WalletLedgerEntryType" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "availableBalanceAfter" DECIMAL(10,2) NOT NULL,
  "heldBalanceAfter" DECIMAL(10,2) NOT NULL,
  "tripPaymentId" TEXT,
  "topUpId" TEXT,
  "note" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallet_accounts_membershipId_key"
  ON "wallet_accounts"("membershipId");

CREATE INDEX "wallet_accounts_institutionId_idx"
  ON "wallet_accounts"("institutionId");

CREATE UNIQUE INDEX "wallet_top_ups_merchantOrderReference_key"
  ON "wallet_top_ups"("merchantOrderReference");

CREATE UNIQUE INDEX "wallet_top_ups_providerOrderToken_key"
  ON "wallet_top_ups"("providerOrderToken");

CREATE INDEX "wallet_top_ups_walletId_status_createdAt_idx"
  ON "wallet_top_ups"("walletId", "status", "createdAt");

CREATE INDEX "wallet_top_ups_providerOrderToken_idx"
  ON "wallet_top_ups"("providerOrderToken");

CREATE INDEX "wallet_ledger_entries_walletId_createdAt_idx"
  ON "wallet_ledger_entries"("walletId", "createdAt");

CREATE INDEX "wallet_ledger_entries_tripPaymentId_type_idx"
  ON "wallet_ledger_entries"("tripPaymentId", "type");

CREATE INDEX "wallet_ledger_entries_topUpId_type_idx"
  ON "wallet_ledger_entries"("topUpId", "type");

ALTER TABLE "wallet_accounts"
  ADD CONSTRAINT "wallet_accounts_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wallet_accounts"
  ADD CONSTRAINT "wallet_accounts_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "user_institution_memberships"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wallet_top_ups"
  ADD CONSTRAINT "wallet_top_ups_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "wallet_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wallet_ledger_entries"
  ADD CONSTRAINT "wallet_ledger_entries_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "wallet_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wallet_ledger_entries"
  ADD CONSTRAINT "wallet_ledger_entries_tripPaymentId_fkey"
  FOREIGN KEY ("tripPaymentId") REFERENCES "trip_payments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "wallet_ledger_entries"
  ADD CONSTRAINT "wallet_ledger_entries_topUpId_fkey"
  FOREIGN KEY ("topUpId") REFERENCES "wallet_top_ups"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
