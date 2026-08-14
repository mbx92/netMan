-- AppUser (local + SSO-provisioned accounts)
CREATE TABLE IF NOT EXISTS "AppUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleName" TEXT NOT NULL DEFAULT 'admin',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppUser_email_key" ON "AppUser"("email");
CREATE INDEX IF NOT EXISTS "AppUser_email_idx" ON "AppUser"("email");

-- MikroTik snapshot column (used by capture/sync)
ALTER TABLE "MikrotikDevice" ADD COLUMN IF NOT EXISTS "lastSnapshot" JSONB;

-- NAS: rename legacy NASDevice table if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'NASDevice'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'NAS'
  ) THEN
    ALTER TABLE "NASDevice" RENAME TO "NAS";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "NAS" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "model" TEXT,
    "location" TEXT,
    "ipAddress" TEXT,
    "username" TEXT,
    "password" TEXT,
    "lastCapturedAt" TIMESTAMP(3),
    "lastSnapshot" JSONB,
    "totalCapacityGB" DOUBLE PRECISION,
    "usedCapacityGB" DOUBLE PRECISION,
    "bayCount" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT,

    CONSTRAINT "NAS_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NAS" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "NAS" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "NAS" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE "NAS" ADD COLUMN IF NOT EXISTS "lastCapturedAt" TIMESTAMP(3);
ALTER TABLE "NAS" ADD COLUMN IF NOT EXISTS "lastSnapshot" JSONB;
ALTER TABLE "NAS" ADD COLUMN IF NOT EXISTS "totalCapacityGB" DOUBLE PRECISION;
ALTER TABLE "NAS" ADD COLUMN IF NOT EXISTS "usedCapacityGB" DOUBLE PRECISION;
ALTER TABLE "NAS" ADD COLUMN IF NOT EXISTS "bayCount" INTEGER;
ALTER TABLE "NAS" ADD COLUMN IF NOT EXISTS "notes" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'NAS' AND column_name = 'host'
  ) THEN
    EXECUTE 'UPDATE "NAS" SET "ipAddress" = "host" WHERE "ipAddress" IS NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'NAS' AND column_name = 'lastSync'
  ) THEN
    EXECUTE 'UPDATE "NAS" SET "lastCapturedAt" = "lastSync" WHERE "lastCapturedAt" IS NULL';
  END IF;
END $$;

ALTER TABLE "NAS" ALTER COLUMN "type" DROP NOT NULL;
ALTER TABLE "NAS" ALTER COLUMN "username" DROP NOT NULL;
ALTER TABLE "NAS" ALTER COLUMN "password" DROP NOT NULL;

DROP INDEX IF EXISTS "NASDevice_host_port_key";
DROP INDEX IF EXISTS "NASDevice_siteId_idx";
CREATE INDEX IF NOT EXISTS "NAS_siteId_idx" ON "NAS"("siteId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NAS_siteId_fkey'
  ) THEN
    ALTER TABLE "NAS"
      ADD CONSTRAINT "NAS_siteId_fkey"
      FOREIGN KEY ("siteId") REFERENCES "Site"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Hikvision
CREATE TABLE IF NOT EXISTS "HikvisionDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 80,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "protocol" TEXT NOT NULL DEFAULT 'http',
    "deviceType" TEXT NOT NULL DEFAULT 'NVR',
    "model" TEXT,
    "serialNumber" TEXT,
    "firmware" TEXT,
    "macAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" TIMESTAMP(3),
    "lastSnapshot" JSONB,
    "siteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HikvisionDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HikvisionDevice_host_port_key" ON "HikvisionDevice"("host", "port");
CREATE INDEX IF NOT EXISTS "HikvisionDevice_siteId_idx" ON "HikvisionDevice"("siteId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HikvisionDevice_siteId_fkey'
  ) THEN
    ALTER TABLE "HikvisionDevice"
      ADD CONSTRAINT "HikvisionDevice_siteId_fkey"
      FOREIGN KEY ("siteId") REFERENCES "Site"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "HikvisionChannel" (
    "id" TEXT NOT NULL,
    "channelIndex" INTEGER NOT NULL,
    "name" TEXT,
    "ipAddress" TEXT,
    "managePort" INTEGER NOT NULL DEFAULT 80,
    "protocol" TEXT,
    "macAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "model" TEXT,
    "firmware" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hikvisionDeviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HikvisionChannel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HikvisionChannel_hikvisionDeviceId_channelIndex_key"
  ON "HikvisionChannel"("hikvisionDeviceId", "channelIndex");
CREATE INDEX IF NOT EXISTS "HikvisionChannel_ipAddress_idx" ON "HikvisionChannel"("ipAddress");
CREATE INDEX IF NOT EXISTS "HikvisionChannel_hikvisionDeviceId_idx" ON "HikvisionChannel"("hikvisionDeviceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HikvisionChannel_hikvisionDeviceId_fkey'
  ) THEN
    ALTER TABLE "HikvisionChannel"
      ADD CONSTRAINT "HikvisionChannel_hikvisionDeviceId_fkey"
      FOREIGN KEY ("hikvisionDeviceId") REFERENCES "HikvisionDevice"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Proxmox
CREATE TABLE IF NOT EXISTS "ProxmoxNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8006,
    "realm" TEXT NOT NULL DEFAULT 'pam',
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" TIMESTAMP(3),
    "lastSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT,

    CONSTRAINT "ProxmoxNode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProxmoxNode_host_port_key" ON "ProxmoxNode"("host", "port");
CREATE INDEX IF NOT EXISTS "ProxmoxNode_siteId_idx" ON "ProxmoxNode"("siteId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProxmoxNode_siteId_fkey'
  ) THEN
    ALTER TABLE "ProxmoxNode"
      ADD CONSTRAINT "ProxmoxNode_siteId_fkey"
      FOREIGN KEY ("siteId") REFERENCES "Site"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
