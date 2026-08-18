-- AlterTable: hardware inventory (disk models, RAM slots/type) reported by the agent
ALTER TABLE "Agent" ADD COLUMN "diskInfo" JSONB;
ALTER TABLE "Agent" ADD COLUMN "memorySlotsTotal" INTEGER;
ALTER TABLE "Agent" ADD COLUMN "memorySlotsUsed" INTEGER;
ALTER TABLE "Agent" ADD COLUMN "memoryType" TEXT;
