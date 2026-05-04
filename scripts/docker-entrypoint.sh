#!/bin/sh

echo "=== ECH CRM Startup ==="

echo "Running database migration..."
node scripts/migrate-prod.js 2>&1

echo "Seeding database..."
node scripts/seed-prod.js 2>&1

echo "Starting application..."
exec node server.js
