#!/bin/sh

echo "=== ECH CRM Startup ==="
echo "DATABASE_URL present: $([ -n "$DATABASE_URL" ] && echo 'yes' || echo 'NO!')"

echo "Running Prisma migrations..."
node node_modules/prisma/build/index.js migrate deploy --schema ./prisma/schema.prisma 2>&1
MIGRATE_EXIT=$?
echo "Migration exit code: $MIGRATE_EXIT"

if [ $MIGRATE_EXIT -ne 0 ]; then
  echo "Migration failed, trying direct schema push..."
  node node_modules/prisma/build/index.js db push --schema ./prisma/schema.prisma --accept-data-loss 2>&1 || echo "Schema push also failed"
fi

echo "Seeding database..."
node scripts/seed-prod.js 2>&1 || echo "Seed skipped"

echo "Starting application..."
exec node server.js
