#!/usr/bin/env bash
set -euo pipefail

REPO="https://raw.githubusercontent.com/jlondrejcka/chytr/main"
INSTALL_DIR=".cursor"

echo "Installing chytr hooks skill..."

# Create directories
mkdir -p "$INSTALL_DIR/hooks"

# Download hooks.json
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
echo "To connect to your chytr instance, set these env vars in your shell or .env:"
echo ""
echo "  export CHYTR_URL=<your-supabase-url>"
echo "  export CHYTR_SERVICE_KEY=<your-supabase-service-key>"
echo "  export WORK_ORDER_ID=<work-order-id>  # set per session"
echo ""
echo "Or add them to your .cursor/mcp.json environment for automatic injection."
