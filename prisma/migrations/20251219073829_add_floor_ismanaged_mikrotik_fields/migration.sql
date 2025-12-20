/*
  Warnings:

  - The values [SWITCH] on the enum `DeviceType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DeviceType_new" AS ENUM ('SMART_TV', 'PC_WINDOWS', 'PC_LINUX', 'SERVER_LINUX', 'SERVER_WINDOWS', 'PRINTER', 'VM', 'ROUTER', 'SWITCH_MANAGED', 'SWITCH_UNMANAGED', 'ACCESS_POINT', 'OTHER');
ALTER TABLE "Device" ALTER COLUMN "type" TYPE "DeviceType_new" USING ("type"::text::"DeviceType_new");
ALTER TYPE "DeviceType" RENAME TO "DeviceType_old";
ALTER TYPE "DeviceType_new" RENAME TO "DeviceType";
DROP TYPE "DeviceType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "apiPass" TEXT,
ADD COLUMN     "apiPort" INTEGER,
ADD COLUMN     "apiUser" TEXT,
ADD COLUMN     "apiVersion" TEXT,
ADD COLUMN     "floor" TEXT,
ADD COLUMN     "isApiActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isManaged" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastApiSync" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Device_floor_idx" ON "Device"("floor");
