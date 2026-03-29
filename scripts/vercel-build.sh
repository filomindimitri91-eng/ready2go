#!/bin/bash
set -e

REPO_ROOT="$(pwd)"
echo "Building from: $REPO_ROOT"

pnpm --filter @workspace/ready2go run build

WORKSPACE_DIST="$REPO_ROOT/artifacts/ready2go/dist"
TARGET_DIST="$REPO_ROOT/dist"

echo "Copying from $WORKSPACE_DIST to $TARGET_DIST"
mkdir -p "$TARGET_DIST"
cp -rf "$WORKSPACE_DIST/." "$TARGET_DIST/"

echo "Build complete. Contents of dist:"
ls "$TARGET_DIST"
