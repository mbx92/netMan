-- AlterTable: extended last-heartbeat snapshot (per-core CPU, I/O rates, partitions, top processes, logged-in users)
ALTER TABLE "Agent" ADD COLUMN "lastMetrics" JSONB;

-- CreateTable: per-heartbeat history for chart data, pruned by the agent-metrics-retention plugin
CREATE TABLE "AgentMetricSample" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpuPercent" DOUBLE PRECISION NOT NULL,
    "memPercent" DOUBLE PRECISION NOT NULL,
    "diskPercent" DOUBLE PRECISION NOT NULL,
    "swapPercent" DOUBLE PRECISION,
    "netRxBytesPerSec" DOUBLE PRECISION,
    "netTxBytesPerSec" DOUBLE PRECISION,
    "diskReadBytesPerSec" DOUBLE PRECISION,
    "diskWriteBytesPerSec" DOUBLE PRECISION,
    "loadAvg1" DOUBLE PRECISION,

    CONSTRAINT "AgentMetricSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentMetricSample_agentId_recordedAt_idx" ON "AgentMetricSample"("agentId", "recordedAt");

ALTER TABLE "AgentMetricSample" ADD CONSTRAINT "AgentMetricSample_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
