#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Repo root: $REPO_ROOT"

# Build the frontend
pnpm --filter @workspace/ready2go run build

# The vite config uses fileURLToPath to resolve __dirname to the workspace dir,
# so the dist is guaranteed to be at artifacts/ready2go/dist
WORKSPACE_DIST="$REPO_ROOT/artifacts/ready2go/dist"

if [ ! -d "$WORKSPACE_DIST" ]; then
  echo "ERROR: dist not found at $WORKSPACE_DIST"
  echo "Contents of artifacts/ready2go:"
  ls -la "$REPO_ROOT/artifacts/ready2go/"
  exit 1
fi

echo "Dist found at: $WORKSPACE_DIST"
mkdir -p "$REPO_ROOT/dist"
cp -rf "$WORKSPACE_DIST/." "$REPO_ROOT/dist/"
echo "Copied to $REPO_ROOT/dist — contents:"
ls "$REPO_ROOT/dist/"
