#!/bin/sh
# Applies pending Prisma migrations, then starts the server.
# `prisma migrate deploy` only applies migrations already committed under
# prisma/migrations — it never resets the schema or touches existing data,
# so this is safe to run on every container start/redeploy.
set -e

echo "==> Waiting for database and applying migrations..."

attempt=1
max_attempts=10
until npx prisma migrate deploy; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "==> Migration failed after ${max_attempts} attempts, giving up."
    exit 1
  fi
  echo "==> Migration attempt ${attempt}/${max_attempts} failed, retrying in 3s..."
  attempt=$((attempt + 1))
  sleep 3
done

echo "==> Migrations applied. Starting NetMan..."
exec node .output/server/index.mjs
