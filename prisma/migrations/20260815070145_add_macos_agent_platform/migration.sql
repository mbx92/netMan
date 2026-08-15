-- AlterEnum: allow macOS as a supported agent platform
ALTER TYPE "AgentPlatform" ADD VALUE 'MACOS';

-- Seed macOS PC device type (idempotent, mirrors prisma/seed.ts)
INSERT INTO "DeviceType" ("id", "code", "name", "icon", "color", "isNetworkDevice", "canHavePorts", "topologyTier", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'PC_MACOS', 'macOS PC', 'desktop', '#94a3b8', false, false, 2, 12, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
