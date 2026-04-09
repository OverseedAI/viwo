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
  "bypassPermissionsModeAccepted": true,
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

# --- Git worktree setup ---

if [ -n "${VIWO_WORKTREE_NAME:-}" ] && [ -d "/repo-git" ]; then
  # Rewrite .git file to point to the mounted repo-git directory
  echo "gitdir: /repo-git/worktrees/$VIWO_WORKTREE_NAME" > /workspace/.git

  git config --global --add safe.directory /workspace

  # Forward host git identity into container
  if [ -n "${GIT_AUTHOR_NAME:-}" ]; then
    git config --global user.name "$GIT_AUTHOR_NAME"
    git config --global user.email "$GIT_AUTHOR_EMAIL"
  fi

  # Use GITHUB_TOKEN for push auth and gh CLI if available
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    git config --global credential.helper '!f() { echo "password=$GITHUB_TOKEN"; }; f'
    git config --global credential.username 'x-access-token'

    # Auth gh CLI so `gh pr create` works
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
  fi
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

CLAUDE_CMD="claude --dangerously-skip-permissions"

if [ -n "${VIWO_MODEL:-}" ]; then
  CLAUDE_CMD="$CLAUDE_CMD --model $VIWO_MODEL"
fi

PROMPT_FILE="/tmp/viwo-state/prompt.txt"

if [ -f "$PROMPT_FILE" ]; then
  # Container was restarted — resume previous session instead of re-sending prompt
  CLAUDE_CMD="$CLAUDE_CMD --continue"
elif [ -n "${VIWO_PROMPT:-}" ]; then
  # First run — write prompt to file and pass to Claude
  printf '%s' "$VIWO_PROMPT" > "$PROMPT_FILE"
  CLAUDE_CMD="$CLAUDE_CMD \"\$(cat $PROMPT_FILE)\""
  unset VIWO_PROMPT
fi

# --- Launch Claude Code inside tmux ---

EXIT_CODE_FILE="/tmp/viwo-state/claude-exit-code"

# Enable mouse scrolling in tmux so users can scroll through output
echo "set -g mouse on" >> ~/.tmux.conf

# Launch Claude Code inside tmux, drop to bash when it exits
# This keeps the tmux session alive so users can always attach
tmux new-session -d -s viwo \
  "$CLAUDE_CMD; echo \$? > $EXIT_CODE_FILE; printf '{\"status\":\"exited\",\"timestamp\":\"%s\",\"exitCode\":%s}' \"\$(date -u +%Y-%m-%dT%H:%M:%SZ)\" \"\$(cat $EXIT_CODE_FILE)\" > $STATE_FILE; exec bash"

# Keep container alive as long as tmux session exists
while tmux has-session -t viwo 2>/dev/null; do
  sleep 2
done
