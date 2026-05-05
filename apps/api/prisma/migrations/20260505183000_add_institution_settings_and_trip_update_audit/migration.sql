ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRIP_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INSTITUTION_SETTINGS_UPDATED';
ALTER TYPE "AuditEntityType" ADD VALUE IF NOT EXISTS 'INSTITUTION';

CREATE TABLE "institution_settings" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "allowCashPayments" BOOLEAN NOT NULL DEFAULT true,
  "allowPaypalPayments" BOOLEAN NOT NULL DEFAULT true,
  "termsDocumentUrl" TEXT,
  "privacyPolicyUrl" TEXT,
  "safetyRulesTitle" TEXT NOT NULL DEFAULT 'Reglas minimas de seguridad',
  "safetyRulesSummary" TEXT NOT NULL DEFAULT 'Respeta el punto de encuentro, confirma tu identidad y mantente atento durante todo el trayecto.',
  "safetyRulesBody" TEXT NOT NULL DEFAULT '1. Llega con anticipacion al punto acordado.\n2. Verifica conductor, vehiculo y placa antes de abordar.\n3. Mantente identificable y avisa cualquier cambio de ultimo momento.\n4. Usa el viaje solo para fines autorizados por tu institucion.\n5. Reporta de inmediato cualquier conducta insegura o fuera de protocolo.',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "institution_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "institution_settings_institutionId_key"
  ON "institution_settings"("institutionId");

ALTER TABLE "institution_settings"
  ADD CONSTRAINT "institution_settings_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "institutions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
