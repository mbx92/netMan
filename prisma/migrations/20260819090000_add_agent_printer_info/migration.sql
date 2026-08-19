-- AlterTable: persist OS print queues reported on agent hello
ALTER TABLE "Agent" ADD COLUMN "printerInfo" JSONB;
