# VIWO Start Command - Implementation Summary

## Overview

The `viwo start` command is the primary entry point for creating isolated development sessions with AI agents. It orchestrates the creation of Git worktrees, Docker containers, and provides an interactive interface for users to work with AI agents like Claude Code.

## Key Features

### 1. Multiline Prompt Input

**Location**: `packages/cli/src/commands/start.ts` (lines 13-50)

The command implements a sophisticated multiline input system that:
- Allows users to **paste multiple lines** without triggering premature execution
- Uses **Ctrl+D to finish** input (or Enter on empty line in some modes)
- Supports **Ctrl+C to cancel** the operation
- Preserves formatting and whitespace in pasted content
- Validates that prompts are not empty before proceeding

**Implementation**: Uses Node.js `readline` interface for terminal input management

**User Experience**: This is a significant improvement over simple single-line prompts, enabling users to craft detailed, multi-paragraph instructions for AI agents.

### 2. Automatic Container Output Streaming

**Location**: `packages/cli/src/commands/start.ts` (lines 160-191)

After initializing a session, the command automatically:
- **Attaches to the Claude Code container** for real-time output
- **Streams all container output** (stdout/stderr) to the terminal
- Shows a clear visual separator: "Press Ctrl+C to detach, container will keep running"
- Implements **non-destructive detachment**: Ctrl+C stops streaming but leaves container running
- Handles attachment errors gracefully

**User Experience**: Users get immediate feedback from the AI agent without manual intervention, while retaining the ability to detach and let the agent continue working in the background.

### 3. Interactive Session Creation Workflow

**Location**: `packages/cli/src/commands/start.ts` (lines 52-158)

Structured flow:
1. **Prerequisites check** - Verifies Git and Docker, checks for version updates
2. **Repository selection** - Interactive list or `-r` flag for direct selection
3. **Branch naming** - Optional custom name or auto-generated format
4. **Multiline prompt** - Detailed instructions for the AI agent
5. **Session initialization** - Creates worktree, Docker container, and database records
6. **Automatic attachment** - Begins streaming container output

## Architecture Components

### Attach Manager (`packages/core/src/managers/attach-manager.ts`)

**Purpose**: Reliable container output streaming using subprocess-based approach

**Key Design Decisions**:
- Uses `docker logs -f` instead of `docker attach` - shows all output from container start, not just from attachment point
- Uses subprocess instead of dockerode - dockerode's attach API is currently broken/unreliable
- Provides both low-level `attachToContainer()` and high-level `attachAndWaitForDetach()` functions

**Functions**:
- **`attachToContainer()`**: Spawns `docker logs -f` subprocess, streams to terminal or custom callbacks, returns detach handle
- **`attachAndWaitForDetach()`**: Attaches and waits for SIGINT (Ctrl+C), automatically cleans up and detaches gracefully

### Core SDK (`packages/core/src/viwo.ts`)

**`start()` method** (lines 57-166):
1. Validates all options with Zod schemas
2. Verifies repository existence and Docker availability
3. Generates or uses custom branch name
4. Creates database session record with INITIALIZING status
5. Creates Git worktree at repository path
6. Copies environment file if specified
7. Initializes Claude Code agent in Docker container
8. Updates session status to RUNNING
9. Handles errors by updating status to ERROR and cleaning up

### Agent Manager (`packages/core/src/managers/agent-manager.ts`)

**`initializeClaudeCode()` function** (lines 40-159):
- Validates Anthropic API key from configuration
- Checks for Claude Code Docker image (`ghcr.io/anthropics/claude-code`)
- Builds command with essential flags:
  - `--dangerously-skip-permissions`: Skips permission checks for automation
  - `--print`: Ensures output is printed to stdout
  - `--verbose`: Provides detailed logging
- Creates container with:
  - Worktree mounted at `/workspace`
  - API key as `ANTHROPIC_API_KEY` environment variable
  - TTY and OpenStdin enabled for interactive capabilities
- Logs initial prompt to `chats` table for history
- Starts container and returns immediately (runs in background)
- Sets up background log streaming to capture output in database

### Docker Manager (`packages/core/src/managers/docker-manager.ts`)

**Platform-specific socket configuration** (lines 20-35):
- **Windows**: `\\.\pipe\docker_engine` (compatible with Docker Desktop, WSL2, and Hyper-V)
- **macOS/Linux**: `/var/run/docker.sock`
- Automatic detection via `process.platform`

**Key capabilities**:
- Container lifecycle management (create, start, stop, remove, inspect)
- Log streaming with Docker multiplexed format handling
- **State synchronization** (`syncDockerState()`, lines 428-571):
  - Syncs container states with database sessions
  - Updates session status based on exit codes (0 = completed, non-zero = error)
  - Captures logs since last activity and stores in `chats` table

## Command Flow

```
viwo start
  ↓
[Prerequisites Check]
  - Git availability
  - Docker daemon status
  - Version check (GitHub releases)
  ↓
[Repository Selection]
  - Interactive list or -r flag
  ↓
[Branch Name Input]
  - Optional custom name
  - Or auto-generated format
  ↓
[Multiline Prompt Input]
  - Ctrl+D to finish
  - Ctrl+C to cancel
  ↓
[Session Initialization]
  - Create database record (INITIALIZING)
  - Create Git worktree
  - Copy .env if specified
  - Initialize Claude Code container
  - Start container
  - Update status to RUNNING
  ↓
[Automatic Container Attachment]
  - Stream all output from container
  - Show visual separator
  - Wait for Ctrl+C to detach
  ↓
[Detach]
  - Container keeps running
  - Show next steps (cd to worktree)
```

## Design Principles

### 1. Non-blocking Execution
The agent container runs in the background, allowing users to:
- Detach and reattach at will
- Let agents work while doing other tasks
- Check back on progress later

### 2. Comprehensive Logging
All container output is captured in the database `chats` table:
- Maintains complete history of agent interactions
- Enables future features like conversation replay
- Supports debugging and troubleshooting

### 3. Graceful Error Handling
- Errors update session status without crashing the CLI
- User-friendly error messages with actionable guidance
- Automatic cleanup of partial state on failure

### 4. User-friendly UX
- Clear instructions at each step
- Visual separators and status badges
- Consistent color-coded output (chalk)
- Loading spinners for long operations (ora)

### 5. Platform Compatibility
- Automatic Docker socket detection
- Works on Windows (Docker Desktop), macOS, and Linux
- No manual configuration required

## Database Schema

**Sessions table** (`packages/core/src/db-schemas/sessions.ts`):
- `id`: UUID primary key
- `repositoryId`: Foreign key to repositories
- `branch`: Git branch name
- `worktreePath`: Absolute path to worktree
- `status`: INITIALIZING → RUNNING → COMPLETED/ERROR/CLEANED
- `containerId`: Docker container ID
- `createdAt`, `updatedAt`: Timestamps

**Chats table** (`packages/core/src/db-schemas/chats.ts`):
- `id`: UUID primary key
- `sessionId`: Foreign key to sessions
- `role`: "user" or "assistant"
- `message`: Text content
- `metadata`: JSON (tool usage, errors, etc.)
- `createdAt`: Timestamp

## Key Dependencies

- **dockerode**: Docker API client
- **simple-git**: Git operations
- **drizzle-orm**: SQLite ORM
- **commander**: CLI framework
- **@inquirer/prompts**: Interactive CLI prompts
- **chalk**: Terminal styling
- **ora**: Loading spinners
- **zod**: Runtime validation

## Notable Implementation Details

### Why `docker logs -f` over `docker attach`?
- `docker logs -f` shows **all output from beginning**, not just from attachment point
- More reliable for showing complete context
- Consistent behavior with TTY containers

### Why subprocess over dockerode for attachment?
- Dockerode's `attach()` API is currently broken/unreliable
- Direct subprocess provides more control
- Easier to handle signals (SIGINT) for detachment

### Why automatic attachment after initialization?
- Immediate feedback improves UX
- Users don't need to remember to attach manually
- Clear instructions prevent confusion about container state

### Why non-destructive detachment?
- Allows agents to continue working on long tasks
- Users can detach during thinking/processing
- Reduces need to keep terminal open

## Testing

**Test coverage** (`packages/cli/src/commands/__tests__/start.test.ts`):
- Branch name generation
- Repository validation
- Multiline input handling
- Error scenarios

**Test isolation**: Automatic in-memory database when `NODE_ENV=test`

## Future Enhancements

Potential improvements identified in codebase:
1. Support for additional AI agents (Cline, Cursor) - currently only Claude Code implemented
2. Docker Compose support for multi-container sessions
3. Session reattachment via `viwo attach <session-id>` command
4. Session log viewing via `viwo logs <session-id>` command
5. Real-time status updates via WebSocket or polling

## Related Commands

- **`viwo list`**: Interactive session list with keyboard navigation, actions (cd to worktree, delete)
- **`viwo clean`**: Cleanup completed/errored sessions, runs `git worktree prune`
- **`viwo repo`**: Repository management (list, add, delete)
- **`viwo config ide`**: Configure default IDE preference

## Conclusion

The `viwo start` command demonstrates a well-architected CLI tool that balances:
- **User experience**: Clear prompts, automatic streaming, non-destructive operations
- **Reliability**: Robust error handling, state synchronization, comprehensive logging
- **Maintainability**: Functional managers, schema validation, centralized types
- **Platform compatibility**: Cross-platform Docker support, automatic detection

The multiline prompt and automatic output streaming features are particularly noteworthy improvements that make the CLI practical for real-world development workflows.
