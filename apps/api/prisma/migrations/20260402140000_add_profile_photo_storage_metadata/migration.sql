CREATE TYPE "AssetStorageProvider" AS ENUM ('IMGUR');

ALTER TABLE "users"
ADD COLUMN "profilePhotoStorageProvider" "AssetStorageProvider",
ADD COLUMN "profilePhotoStorageKey" TEXT;
