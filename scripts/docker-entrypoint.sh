#!/bin/sh

echo "Running Prisma migrations..."
node node_modules/prisma/build/index.js migrate deploy || echo "Migration failed or skipped - continuing startup"

echo "Starting application..."
exec node server.js
