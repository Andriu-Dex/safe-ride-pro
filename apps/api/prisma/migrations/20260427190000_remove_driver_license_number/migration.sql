DROP INDEX IF EXISTS "driver_profiles_licenseNumber_key";

ALTER TABLE "driver_profiles"
DROP COLUMN IF EXISTS "licenseNumber";
