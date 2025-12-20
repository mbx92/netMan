/*
  Migration: Add DeviceType master data table
  
  This migration:
  1. Adds typeCode column first with converted data
  2. Drops old type column and DeviceType enum
  3. Creates new DeviceType table
  4. Seeds initial device types
  5. Adds foreign key constraint
*/

-- Step 1: Add typeCode column with conversion from old enum (allow NULL temporarily)
ALTER TABLE "Device" ADD COLUMN "typeCode" TEXT;

-- Step 2: Convert existing enum values to typeCode strings
UPDATE "Device" SET "typeCode" = "type"::TEXT;

-- Step 3: Handle any NULL values
UPDATE "Device" SET "typeCode" = 'OTHER' WHERE "typeCode" IS NULL;

-- Step 4: Make typeCode NOT NULL
ALTER TABLE "Device" ALTER COLUMN "typeCode" SET NOT NULL;

-- Step 5: Drop the old type column and index
DROP INDEX IF EXISTS "Device_type_idx";
ALTER TABLE "Device" DROP COLUMN "type";

-- Step 6: Drop the old Enum (must be done BEFORE creating table with same name)
DROP TYPE IF EXISTS "DeviceType";

-- Step 7: Create DeviceType table
CREATE TABLE "DeviceType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "isNetworkDevice" BOOLEAN NOT NULL DEFAULT false,
    "canHavePorts" BOOLEAN NOT NULL DEFAULT false,
    "topologyTier" INTEGER NOT NULL DEFAULT 2,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceType_pkey" PRIMARY KEY ("id")
);

-- Step 8: Create unique index on code
CREATE UNIQUE INDEX "DeviceType_code_key" ON "DeviceType"("code");

-- Step 9: Seed DeviceType records
INSERT INTO "DeviceType" ("id", "code", "name", "icon", "color", "isNetworkDevice", "canHavePorts", "topologyTier", "sortOrder", "isActive")
VALUES
    (gen_random_uuid(), 'ROUTER', 'Router', 'router', '#6366f1', true, true, 0, 1, true),
    (gen_random_uuid(), 'SWITCH_MANAGED', 'Managed Switch', 'switch', '#06b6d4', true, true, 1, 2, true),
    (gen_random_uuid(), 'SWITCH_UNMANAGED', 'Unmanaged Switch', 'switch', '#22d3ee', true, true, 1, 3, true),
    (gen_random_uuid(), 'ACCESS_POINT', 'Access Point', 'wifi', '#f59e0b', true, false, 1, 4, true),
    (gen_random_uuid(), 'SERVER_LINUX', 'Linux Server', 'server', '#22c55e', false, false, 2, 5, true),
    (gen_random_uuid(), 'SERVER_WINDOWS', 'Windows Server', 'server', '#3b82f6', false, false, 2, 6, true),
    (gen_random_uuid(), 'PC_WINDOWS', 'Windows PC', 'desktop', '#a855f7', false, false, 2, 7, true),
    (gen_random_uuid(), 'PC_LINUX', 'Linux PC', 'desktop', '#84cc16', false, false, 2, 8, true),
    (gen_random_uuid(), 'VM', 'Virtual Machine', 'cloud', '#8b5cf6', false, false, 2, 9, true),
    (gen_random_uuid(), 'PRINTER', 'Printer', 'printer', '#6b7280', false, false, 2, 10, true),
    (gen_random_uuid(), 'SMART_TV', 'Smart TV', 'tv', '#ec4899', false, false, 2, 11, true),
    (gen_random_uuid(), 'OTHER', 'Other', 'device', '#6b7280', false, false, 2, 99, true),
    -- Legacy type for backward compatibility (in case there's old SWITCH type)
    (gen_random_uuid(), 'SWITCH', 'Switch (Legacy)', 'switch', '#06b6d4', true, true, 1, 100, true);

-- Step 10: Create index on typeCode
CREATE INDEX "Device_typeCode_idx" ON "Device"("typeCode");

-- Step 11: Add foreign key constraint
ALTER TABLE "Device" ADD CONSTRAINT "Device_typeCode_fkey" FOREIGN KEY ("typeCode") REFERENCES "DeviceType"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
