#!/bin/bash

# Clean script for removing all node_modules, lock files, and databases
echo "🧹 Cleaning project..."

# Show what we're about to clean
echo "🔍 Finding files to clean..."
find . -name "node_modules" -type d
find . -name "yarn.lock"
find . -name "*.db3*"

# Remove node_modules, yarn.lock files
echo "🗑️ Removing node_modules and lock files..."
rm -rf node_modules examples/*/node_modules
rm -f yarn.lock examples/*/yarn.lock

# Remove database files in root and example directories
echo "🗑️ Removing database files..."
find . -name "*.db3*" -type f -delete
find . -name "*.sqlcipher_salt" -type f -delete

echo "✅ Clean completed!" 