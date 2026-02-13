#!/bin/sh
set -e

echo "Pushing database schema..."
npx drizzle-kit push

echo "Starting server..."
node server.js
