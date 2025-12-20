-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('SMART_TV', 'PC_WINDOWS', 'PC_LINUX', 'SERVER_LINUX', 'PRINTER', 'VM', 'ROUTER', 'SWITCH', 'ACCESS_POINT', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "PortStatus" AS ENUM ('UP', 'DOWN', 'DISABLED');

-- CreateEnum
CREATE TYPE "RemoteProtocol" AS ENUM ('SSH', 'RDP', 'VNC', 'CONSOLE', 'HTTP');

-- CreateEnum
CREATE TYPE "AllocationType" AS ENUM ('STATIC', 'DHCP', 'RESERVED');

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "ip" TEXT,
    "mac" TEXT,
    "hostname" TEXT,
    "location" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastSeen" TIMESTAMP(3),
    "owner" TEXT,
    "notes" TEXT,
    "wakeable" BOOLEAN NOT NULL DEFAULT false,
    "portCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkPort" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "portName" TEXT NOT NULL,
    "portNumber" INTEGER,
    "vlan" TEXT,
    "speed" TEXT,
    "status" "PortStatus" NOT NULL DEFAULT 'DOWN',
    "macLearned" TEXT[],
    "description" TEXT,
    "connectedDeviceId" TEXT,

    CONSTRAINT "NetworkPort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemoteSession" (
    "id" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "protocol" "RemoteProtocol" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "RemoteSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "details" JSONB,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IPRange" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "gateway" TEXT,
    "vlan" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IPRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IPAllocation" (
    "id" TEXT NOT NULL,
    "rangeId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "mac" TEXT,
    "hostname" TEXT,
    "type" "AllocationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IPAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MikrotikDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8728,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL DEFAULT 'v6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT,

    CONSTRAINT "MikrotikDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_name_key" ON "Site"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Device_mac_key" ON "Device"("mac");

-- CreateIndex
CREATE INDEX "Device_type_idx" ON "Device"("type");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "Device_location_idx" ON "Device"("location");

-- CreateIndex
CREATE INDEX "Device_siteId_idx" ON "Device"("siteId");

-- CreateIndex
CREATE INDEX "NetworkPort_connectedDeviceId_idx" ON "NetworkPort"("connectedDeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkPort_deviceId_portName_key" ON "NetworkPort"("deviceId", "portName");

-- CreateIndex
CREATE INDEX "RemoteSession_user_idx" ON "RemoteSession"("user");

-- CreateIndex
CREATE INDEX "RemoteSession_targetId_idx" ON "RemoteSession"("targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actor_idx" ON "AuditLog"("actor");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IPRange_network_key" ON "IPRange"("network");

-- CreateIndex
CREATE UNIQUE INDEX "IPAllocation_rangeId_ip_key" ON "IPAllocation"("rangeId", "ip");

-- CreateIndex
CREATE INDEX "MikrotikDevice_siteId_idx" ON "MikrotikDevice"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "MikrotikDevice_host_port_key" ON "MikrotikDevice"("host", "port");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPort" ADD CONSTRAINT "NetworkPort_connectedDeviceId_fkey" FOREIGN KEY ("connectedDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkPort" ADD CONSTRAINT "NetworkPort_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteSession" ADD CONSTRAINT "RemoteSession_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IPAllocation" ADD CONSTRAINT "IPAllocation_rangeId_fkey" FOREIGN KEY ("rangeId") REFERENCES "IPRange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MikrotikDevice" ADD CONSTRAINT "MikrotikDevice_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
