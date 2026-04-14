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
  unset CLAUDE_CODE_OAUTH_TOKEN

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

  if [ -n "${GITHUB_TOKEN:-}" ] || [ -n "${GITLAB_TOKEN:-}" ]; then
    git config --global credential.helper '!f() { host=""; while IFS= read -r line; do case "$line" in host=*) host="${line#host=}" ;; esac; done; if [ "$host" = "github.com" ] && [ -n "${GITHUB_TOKEN:-}" ]; then echo "username=x-access-token"; echo "password=$GITHUB_TOKEN"; elif [ "$host" = "${VIWO_GITLAB_HOST:-gitlab.com}" ] && [ -n "${GITLAB_TOKEN:-}" ]; then echo "username=oauth2"; echo "password=$GITLAB_TOKEN"; fi; }; f'
  fi

  # Auth gh CLI so `gh pr create` works
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
  fi

  # Auth glab CLI if available so GitLab commands work inside the container
  if [ -n "${GITLAB_TOKEN:-}" ]; then
    glab auth login --hostname "${VIWO_GITLAB_HOST:-gitlab.com}" --token "$GITLAB_TOKEN" 2>/dev/null || true
  fi
fi

# --- Configure Claude Code hooks for state reporting ---

cat > "${SETTINGS_DIR}/settings.json" <<'SETTINGS_EOF'
{
  "autoUpdates": false,
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

# --- Run pre-agent commands ---

if [ -n "${VIWO_PRE_AGENT_COMMANDS:-}" ]; then
  echo "Running pre-agent setup commands..."
  cd /workspace
  while IFS= read -r cmd; do
    echo "+ $cmd"
    eval "$cmd"
  done < <(node -e "JSON.parse(process.env.VIWO_PRE_AGENT_COMMANDS).forEach(c => console.log(c))")
  unset VIWO_PRE_AGENT_COMMANDS
fi

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

# --- Launch Claude Code under dtach ---

EXIT_CODE_FILE="/tmp/viwo-state/claude-exit-code"
# Socket lives outside the host bind mount: macOS Docker bind mounts (virtiofs)
# don't support unix sockets, and keeping it container-only avoids leaking the
# socket file onto the host where another host process could attach to it.
VIWO_SOCKET="/tmp/viwo.sock"

# dtach -N creates a new session, runs the child in a PTY, and stays in the
# foreground as PID 1. When the inner bash exits, dtach exits and the
# container stops.
exec dtach -N "$VIWO_SOCKET" -r winch bash -c "
  $CLAUDE_CMD
  echo \$? > $EXIT_CODE_FILE
  printf '{\"status\":\"exited\",\"timestamp\":\"%s\",\"exitCode\":%s}' \\
    \"\$(date -u +%Y-%m-%dT%H:%M:%SZ)\" \"\$(cat $EXIT_CODE_FILE)\" > $STATE_FILE
  exec bash
"
