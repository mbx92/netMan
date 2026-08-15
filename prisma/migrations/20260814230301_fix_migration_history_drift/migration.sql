-- Corrects migration history so a fresh `prisma migrate deploy` (e.g. a new
-- Docker deployment) produces the exact same schema as the live dev database
-- and prisma/schema.prisma. Found by replaying all migrations against an
-- empty schema and diffing the result against schema.prisma:
--
-- 1. The old "NASDevice" table (pre-rename to "NAS") was dropped on the live
--    dev DB out-of-band (not via a tracked migration), so it never got a
--    corresponding migration here — a fresh deploy would still create it.
-- 2. Four foreign keys (NAS.siteId, HikvisionDevice.siteId,
--    HikvisionChannel.hikvisionDeviceId, ProxmoxNode.siteId) exist on the
--    live dev DB but were likewise never captured in a migration.
--
-- Both changes are written defensively (IF EXISTS / duplicate_object guard)
-- so this migration is a no-op on databases that already have the correct
-- final state (like netman_dev today) and only takes effect on databases
-- that replayed migration history from scratch.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'NASDevice') THEN
    ALTER TABLE "NASDevice" DROP CONSTRAINT IF EXISTS "NASDevice_siteId_fkey";
    DROP TABLE "NASDevice";
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE "NAS" ADD CONSTRAINT "NAS_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HikvisionDevice" ADD CONSTRAINT "HikvisionDevice_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HikvisionChannel" ADD CONSTRAINT "HikvisionChannel_hikvisionDeviceId_fkey" FOREIGN KEY ("hikvisionDeviceId") REFERENCES "HikvisionDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProxmoxNode" ADD CONSTRAINT "ProxmoxNode_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
