-- AlterTable: operator-set friendly display name, independent of the machine-reported hostname
ALTER TABLE "Agent" ADD COLUMN "alias" TEXT;
