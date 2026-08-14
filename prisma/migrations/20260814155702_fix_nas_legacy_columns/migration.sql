-- Drop legacy NASDevice columns left over from the NASDevice -> NAS rename
-- (20260814010000_add_app_user_integrations already migrated their data into
-- ipAddress/lastCapturedAt). "host" was still NOT NULL with no default,
-- which broke every POST /api/nas since the current schema no longer sends it.
ALTER TABLE "NAS" DROP COLUMN IF EXISTS "host";
ALTER TABLE "NAS" DROP COLUMN IF EXISTS "port";
ALTER TABLE "NAS" DROP COLUMN IF EXISTS "lastSync";
