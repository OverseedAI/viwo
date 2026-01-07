#!/usr/bin/env bash
set -euo pipefail

CONFIG="${HOME}/.claude.json"
SETTINGS_DIR="${HOME}/.claude"

mkdir -p "$SETTINGS_DIR"

# Extract Claude preferences from base64-encoded tar in environment variable
if [ -n "${VIWO_CLAUDE_PREFERENCES_TAR_BASE64:-}" ]; then
  echo "[viwo] Extracting Claude preferences from environment variable..."
  echo "$VIWO_CLAUDE_PREFERENCES_TAR_BASE64" | base64 -d | tar -xf - -C "$SETTINGS_DIR"
  echo "[viwo] Claude preferences imported successfully"
fi

# Optional: approve the current API key (last 20 chars) instead of "*"
last20=""
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  last20="${ANTHROPIC_API_KEY: -20}"
fi

# Global config: onboarding + API key approval
cat > "$CONFIG" <<EOF
{
  "hasCompletedOnboarding": true,
  "hasCompletedProjectOnboarding": true,
  "hasTrustDialogAccepted": true,
  "bypassPermissionsAccepted": true,
  "customApiKeyResponses": {
    "approved": ["$last20"],
    "rejected": []
  }
}
EOF

# Settings: default permission mode = bypassPermissions
#cat > "${SETTINGS_DIR}/settings.json" <<'EOF'
#{
#  "$schema": "https://json.schemastore.org/claude-code-settings.json",
#  "permissions": {
#    "allow": [],
#    "deny": [],
#    "defaultMode": "bypassPermissions"
#  }
#}
#EOF

exec "$@"
