-- CreateEnum
CREATE TYPE "AgentPlatform" AS ENUM ('WINDOWS', 'LINUX');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('PENDING', 'ONLINE', 'OFFLINE');

-- AlterTable
ALTER TABLE "RemoteSession" ADD COLUMN     "viaAgentId" TEXT;

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "platform" "AgentPlatform" NOT NULL,
    "hostname" TEXT NOT NULL,
    "osVersion" TEXT,
    "agentVersion" TEXT,
    "enrollTokenHash" TEXT,
    "enrollExpiresAt" TIMESTAMP(3),
    "enrolledAt" TIMESTAMP(3),
    "authKeyHash" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'PENDING',
    "lastSeen" TIMESTAMP(3),
    "lastIp" TEXT,
    "lastCpuPercent" DOUBLE PRECISION,
    "lastMemPercent" DOUBLE PRECISION,
    "lastDiskPercent" DOUBLE PRECISION,
    "lastUptimeSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_deviceId_key" ON "Agent"("deviceId");

-- CreateIndex
CREATE INDEX "Agent_status_idx" ON "Agent"("status");

-- CreateIndex
CREATE INDEX "Agent_deviceId_idx" ON "Agent"("deviceId");

-- CreateIndex
CREATE INDEX "RemoteSession_viaAgentId_idx" ON "RemoteSession"("viaAgentId");

-- AddForeignKey
ALTER TABLE "RemoteSession" ADD CONSTRAINT "RemoteSession_viaAgentId_fkey" FOREIGN KEY ("viaAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
