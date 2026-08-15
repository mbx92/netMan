-- AlterTable: Windows-only, the TightVNC password the install/update script generated
ALTER TABLE "Agent" ADD COLUMN "vncPassword" TEXT;
