-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "parentDeviceId" TEXT;

-- CreateTable
CREATE TABLE "NASDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 5000,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT,

    CONSTRAINT "NASDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NASDevice_siteId_idx" ON "NASDevice"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "NASDevice_host_port_key" ON "NASDevice"("host", "port");

-- CreateIndex
CREATE INDEX "Device_parentDeviceId_idx" ON "Device"("parentDeviceId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_parentDeviceId_fkey" FOREIGN KEY ("parentDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NASDevice" ADD CONSTRAINT "NASDevice_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
