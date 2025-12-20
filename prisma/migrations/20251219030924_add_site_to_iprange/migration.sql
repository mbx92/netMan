/*
  Warnings:

  - A unique constraint covering the columns `[siteId,network]` on the table `IPRange` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "IPRange_network_key";

-- AlterTable
ALTER TABLE "IPRange" ADD COLUMN     "siteId" TEXT;

-- CreateIndex
CREATE INDEX "IPRange_siteId_idx" ON "IPRange"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "IPRange_siteId_network_key" ON "IPRange"("siteId", "network");

-- AddForeignKey
ALTER TABLE "IPRange" ADD CONSTRAINT "IPRange_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
