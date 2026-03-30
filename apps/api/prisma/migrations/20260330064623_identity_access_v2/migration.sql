-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'AUTH_VERIFICATION_CODE_RESENT';
ALTER TYPE "AuditAction" ADD VALUE 'AUTH_PASSWORD_RESET_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTH_PASSWORD_RESET_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTH_SESSION_REFRESHED';
ALTER TYPE "AuditAction" ADD VALUE 'AUTH_LOGGED_OUT';

-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_codes_tokenHash_key" ON "password_reset_codes"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_codes_userId_createdAt_idx" ON "password_reset_codes"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "password_reset_codes_userId_usedAt_expiresAt_idx" ON "password_reset_codes"("userId", "usedAt", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_sessions_tokenHash_key" ON "refresh_token_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_sessions_userId_createdAt_idx" ON "refresh_token_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "refresh_token_sessions_userId_revokedAt_expiresAt_idx" ON "refresh_token_sessions"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "refresh_token_sessions_expiresAt_revokedAt_idx" ON "refresh_token_sessions"("expiresAt", "revokedAt");

-- CreateIndex
CREATE INDEX "email_verification_codes_userId_createdAt_idx" ON "email_verification_codes"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token_sessions" ADD CONSTRAINT "refresh_token_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
