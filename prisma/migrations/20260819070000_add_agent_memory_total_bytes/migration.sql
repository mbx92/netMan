-- AlterTable: persist installed RAM capacity reported on agent hello
ALTER TABLE "Agent" ADD COLUMN "memoryTotalBytes" BIGINT;
