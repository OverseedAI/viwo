# PRD: Long-Running Interactive Claude Code Containers

## Introduction

VIWO currently runs ephemeral Claude Code sessions in headless mode inside Docker containers. This architecture rehaul replaces that with long-running containers running Claude Code in regular interactive mode via tmux. Users can attach to live sessions, provide follow-up prompts, detach, and monitor session state — all without losing context.

This separates three concerns internally (worktree creation, containerization, agent harness) while keeping `viwo start` as the primary orchestrated flow. Lower-level commands for each phase will be added in a future PRD.

## Goals

- Replace headless ephemeral containers with long-running interactive containers
- Enable attach/detach to live Claude Code sessions via tmux
- Track two layers of state: Docker container state (running/stopped) and Claude Code state (working/awaiting_input/exited)
- Surface Claude Code state back to the host via volume-bound state files
- Keep `viwo start` as the primary UX while cleanly separating internal phases for future composability
- Maintain one Claude Code conversation per container

## User Stories

### US-001: Updated container entrypoint with tmux

**Description:** As a developer, I need the Docker container to start a tmux session running Claude Code so that the session persists independently of any attached terminal.

**Acceptance Criteria:**

- [ ] Container entrypoint starts a tmux session named `viwo`
- [ ] Claude Code is launched inside tmux with the user's prompt: `claude "prompt here"`
- [ ] Container stays alive after Claude Code exits (entrypoint falls through to `bash`)
- [ ] tmux is installed in the Docker image
- [ ] Typecheck passes

### US-002: State file via volume bind

**Description:** As a user, I want VIWO to know what my session is doing (working, waiting for input, exited) without me having to attach to it.

**Acceptance Criteria:**

- [ ] Host directory `{viwo-data}/container-state/{session-id}/` is created per session
- [ ] Directory is volume-bound to `/tmp/` inside the container so `/tmp/viwo-state.json` maps to the host
- [ ] Claude Code hooks (Notification, PostToolUse) write state updates to `/tmp/viwo-state.json`
- [ ] State file contains: `status` ("working" | "awaiting_input" | "exited"), `timestamp` (ISO 8601), `exitCode` (number, only when exited)
- [ ] `.claude/settings.json` is configured inside the container with the appropriate hooks
- [ ] Typecheck passes

### US-003: `viwo start` updated flow

**Description:** As a user, I want `viwo start` to create a worktree, spin up a long-running container with tmux, and start Claude Code with my prompt — then return control to me.

**Acceptance Criteria:**

- [ ] `viwo start` creates the worktree, container, and launches Claude Code in tmux
- [ ] The three internal phases (worktree, container, agent) are cleanly separated in the SDK
- [ ] After initialization, prints session ID, status, and attach instructions
- [ ] Container runs in the background; CLI exits after setup
- [ ] State file is initialized with `{"status": "working", "timestamp": "..."}`
- [ ] Typecheck passes

### US-004: `viwo attach` command

**Description:** As a user, I want to attach to a running Claude Code session to see what it's doing and provide follow-up prompts.

**Acceptance Criteria:**

- [ ] `viwo attach` with no args shows interactive list of running sessions (similar to `viwo list` UX)
- [ ] `viwo attach <session-id>` attaches directly to the specified session
- [ ] Attach runs `docker exec -it <container> tmux attach -t viwo`
- [ ] Before attaching, prints hint: "Detach with Ctrl+B, D"
- [ ] If session is not running, shows appropriate error message
- [ ] Typecheck passes

### US-005: `viwo list` shows two-layer state

**Description:** As a user, I want `viwo list` to show both the Docker container state and the Claude Code agent state so I know exactly what's happening.

**Acceptance Criteria:**

- [ ] `viwo list` checks Docker container state (running/stopped) via dockerode
- [ ] `viwo list` reads `{viwo-data}/container-state/{session-id}/viwo-state.json` for Claude Code state
- [ ] Displays composite status: e.g., "running / awaiting_input", "running / working", "stopped / exited"
- [ ] Shows last state update timestamp
- [ ] Gracefully handles missing or malformed state files (falls back to "unknown" for agent state)
- [ ] Typecheck passes

### US-007: Container naming convention and recreation

**Description:** As a user, I want containers to follow a predictable naming pattern so I can identify them, and I want VIWO to recreate a container with the same name if the original is gone.

**Acceptance Criteria:**

- [ ] Containers are named `viwo-{identifier}` (e.g., `viwo-abc123`)
- [ ] Identifier is stable per session (derived from session ID or a short hash)
- [ ] If a container with the expected name doesn't exist but the session/worktree does, `viwo start` or `viwo attach` can recreate it with the same name
- [ ] Recreated container reuses the same worktree mount and state directory
- [ ] Typecheck passes

### US-006: Container cleanup includes state directory

**Description:** As a developer, I need session cleanup to also remove the container state directory on the host.

**Acceptance Criteria:**

- [ ] `viwo clean` removes `{viwo-data}/container-state/{session-id}/` for cleaned sessions
- [ ] State directory removal happens after container removal
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Docker image must include `tmux` in its installed packages
- FR-2: Container entrypoint must start a tmux session named `viwo` and run `claude "<prompt>"` inside it
- FR-3: Container entrypoint must keep the container alive after Claude Code exits (fall through to `bash`)
- FR-4: Each session must have a host-side state directory at `{viwo-data}/container-state/{session-id}/`
- FR-5: The state directory must be volume-bound to `/tmp/` in the container
- FR-6: Claude Code hooks (`Notification`, `PostToolUse`) must write JSON state to `/tmp/viwo-state.json`
- FR-7: State JSON schema: `{ status: "working" | "awaiting_input" | "exited", timestamp: string, exitCode?: number }`
- FR-8: `viwo start` must orchestrate worktree creation, container startup, and agent launch as three distinct internal phases
- FR-9: `viwo attach` must list running sessions when called without arguments
- FR-10: `viwo attach <id>` must exec into the container's tmux session
- FR-11: `viwo attach` must print detach instructions before attaching
- FR-12: `viwo list` must check both Docker container state (running/stopped) and Claude Code state (from state file) — two distinct layers
- FR-13: `viwo clean` must remove state directories alongside container and worktree cleanup
- FR-14: Multiple tmux attach clients to the same session share the view (default tmux behavior, documented as known behavior)
- FR-15: Containers must be named `viwo-{identifier}` where identifier is stable per session
- FR-16: If a session's container is missing (stopped and removed, or crashed), VIWO must be able to recreate a container with the same name, reusing the existing worktree and state directory
- FR-17: Container recreation must preserve the worktree mount and volume binds so follow-up work continues in the same environment

## Non-Goals

- No lower-level CLI commands (`viwo worktree`, `viwo container`, `viwo agent`) in this iteration — future PRD
- No custom tmux configuration or wrapper keybindings — raw tmux detach (Ctrl+B, D) is sufficient
- No rich state data (token counts, tool history) — minimal state only
- No multi-conversation support per container — strictly 1:1
- No web UI or dashboard for session monitoring
- No automatic reattach or session reconnection logic

## Technical Considerations

- **Container entrypoint rewrite**: The current `claude-bootstrap.sh` needs to be reworked to use tmux. The bootstrap still handles credential setup (OAuth/API key) before launching Claude Code.
- **Volume bind path**: `{viwo-data}/container-state/{session-id}/viwo-state.json` on host maps to `/tmp/viwo-state.json` in container. The `docker-manager` must add this bind mount when creating the container.
- **Hooks configuration**: A `.claude/settings.json` must be written inside the container (or mounted) with PostToolUse and Notification hooks that write to `/tmp/viwo-state.json`.
- **SDK separation**: Internally refactor `viwo.start()` so that worktree creation, container startup, and agent launch are distinct functions that can be composed. This enables the future hybrid CLI surface.
- **State file race conditions**: Hooks write atomically (overwrite entire file). Since there's one writer (Claude Code process) and one reader (viwo CLI on host), no locking is needed.
- **dockerode**: Continue using dockerode for container management. The `attach` command will shell out to `docker exec` since dockerode doesn't support interactive TTY attach well.
- **tmux availability**: The Docker image must install tmux. Check if the base image already includes it; if not, add to Dockerfile.
- **Two-layer state model**: Docker container state (running/stopped) is checked via dockerode. Claude Code state (working/awaiting_input/exited) is read from the volume-bound state file. These are independent — a container can be running while Claude Code is awaiting input, or stopped while the state file says "exited".
- **Container naming**: Containers follow `viwo-{identifier}` pattern. The identifier should be deterministic from the session ID (e.g., first 8 chars of session UUID) so it's stable and predictable.
- **Container recreation**: When a container is gone but the session and worktree still exist, VIWO recreates a new container with the same `viwo-{identifier}` name, same worktree mount, same state volume bind. This enables long-lived sessions that survive container restarts. The new container starts with a fresh tmux + bash (no auto-launched Claude Code), and the user can attach and run `claude --continue` to resume.

## Success Metrics

- User can start a session, detach, and reattach without losing any context
- `viwo list` accurately reflects session state within 5 seconds of a state change
- Container stays alive and functional after Claude Code completes its task
- No increase in session startup time beyond 2-3 seconds (tmux overhead)

## Open Questions

- Should `viwo attach` support passing a follow-up prompt directly (e.g., `viwo attach <id> --prompt "now do X"`)? Could pipe text into tmux.
- Should state file include the original prompt for display in `viwo list`?
- What happens if the user runs `claude --continue` or `claude --resume` manually inside the container — should viwo track that?
- Should there be a `viwo send <id> "prompt"` command to send a prompt without attaching (fire-and-forget)?
