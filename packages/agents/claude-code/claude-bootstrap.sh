#!/usr/bin/env bash
set -euo pipefail

CONFIG="${HOME}/.claude.json"
SETTINGS_DIR="${HOME}/.claude"
CREDENTIALS_FILE="${SETTINGS_DIR}/.credentials.json"
STATE_FILE="/tmp/viwo-state/viwo-state.json"

mkdir -p "$SETTINGS_DIR"

# --- Credential setup ---

if [ -n "${VIWO_OAUTH_CREDENTIALS:-}" ]; then
  # OAuth mode: write pre-built JSON files directly
  printf '%s' "$VIWO_OAUTH_CREDENTIALS" > "$CREDENTIALS_FILE"
  chmod 600 "$CREDENTIALS_FILE"

  printf '%s' "$VIWO_OAUTH_CONFIG" > "$CONFIG"

  unset VIWO_OAUTH_CREDENTIALS
  unset VIWO_OAUTH_CONFIG

elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  # API key mode
  last20="${ANTHROPIC_API_KEY: -20}"
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

else
  echo "Error: No authentication credentials provided" >&2
  echo "Configure auth with 'viwo auth' (API key or Claude subscription)" >&2
  exit 1
fi

# --- Configure Claude Code hooks for state reporting ---

cat > "${SETTINGS_DIR}/settings.json" <<'SETTINGS_EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "printf '{\"status\":\"working\",\"timestamp\":\"%s\"}' \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > /tmp/viwo-state/viwo-state.json"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "printf '{\"status\":\"awaiting_input\",\"timestamp\":\"%s\"}' \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" > /tmp/viwo-state/viwo-state.json"
          }
        ]
      }
    ]
  }
}
SETTINGS_EOF

# --- Build Claude command ---

CLAUDE_CMD="claude --dangerously-skip-permissions --print --verbose"

if [ -n "${VIWO_MODEL:-}" ]; then
  CLAUDE_CMD="$CLAUDE_CMD --model $VIWO_MODEL"
fi

if [ -n "${VIWO_PROMPT:-}" ]; then
  CLAUDE_CMD="$CLAUDE_CMD \"$VIWO_PROMPT\""
fi

# --- Launch Claude Code inside tmux ---

EXIT_CODE_FILE="/tmp/viwo-state/claude-exit-code"
tmux new-session -d -s viwo "$CLAUDE_CMD; echo \$? > $EXIT_CODE_FILE"

# Keep container alive after Claude Code exits
# Wait for tmux session to end, then fall through to bash
while tmux has-session -t viwo 2>/dev/null; do
  sleep 2
done

# Write exited state with exit code
EXIT_CODE=$(cat "$EXIT_CODE_FILE" 2>/dev/null || echo "1")
printf '{"status":"exited","timestamp":"%s","exitCode":%s}' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$EXIT_CODE" > "$STATE_FILE"

exec bash
