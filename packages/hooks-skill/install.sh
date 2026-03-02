#!/usr/bin/env bash
set -euo pipefail

REPO="https://raw.githubusercontent.com/cloudbeastio/chytr/main"

TARGET_DIR="${1:-.}"
cd "$TARGET_DIR" || { echo "Error: cannot cd to $TARGET_DIR"; exit 1; }

INSTALL_DIR=".cursor"

echo "Installing chytr hooks skill into $(pwd)/.cursor/ ..."

mkdir -p "$INSTALL_DIR/hooks"

# hooks.json: Cursor requires version (number) + hooks (object keyed by event name)
curl -fsSL "$REPO/packages/hooks-skill/.cursor/hooks.json" \
  -o "$INSTALL_DIR/hooks.json"

# Download hook scripts
for SCRIPT in chytr-log.sh chytr-session.sh chytr-stop.sh; do
  curl -fsSL "$REPO/packages/hooks-skill/.cursor/hooks/$SCRIPT" \
    -o "$INSTALL_DIR/hooks/$SCRIPT"
  chmod +x "$INSTALL_DIR/hooks/$SCRIPT"
done

echo ""
echo "chytr hooks installed successfully!"
echo ""
echo "To stream logs to your chytr app, set these env vars (shell, .env, or Cursor cloud env):"
echo ""
echo "  CHYTR_URL          App base URL (e.g. https://app.chytr.ai or http://localhost:3000)"
echo "  CHYTR_API_KEY      API key from chytr Settings -> API Keys (Bearer auth for /api/v1/ingest)"
echo "  WORK_ORDER_ID      Optional; scopes events to a work order"
echo ""
echo "Events POST to \${CHYTR_URL}/api/v1/ingest. If unset, hooks exit silently."
echo "Or add CHYTR_URL + CHYTR_API_KEY to .cursor env / Cursor cloud settings for injection."
