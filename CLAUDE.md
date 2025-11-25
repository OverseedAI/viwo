# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Install dependencies
bun install

# Type checking
bun run typecheck              # All packages
cd packages/core && bun run typecheck  # Core only

# Testing
cd packages/core && bun test   # Run all tests
bun test <test-file>.test.ts   # Run specific test

# Code quality
bun run format                 # Format code
bun run format:check           # Check formatting
bun run lint                   # Lint code

# Build for production
bun run build                  # All packages

# Database
bun run db:generate            # Generate Drizzle migrations

# Run CLI during development
bun packages/cli/src/cli.ts --help  # Direct source execution
viwo --help                         # If globally linked
```

## Architecture Overview

VIWO (Virtualized Isolated Worktree Orchestrator) manages git worktrees, Docker containers, and AI agents for isolated development sessions.

### Monorepo Structure

- **packages/core** (`@viwo/core`) - SDK with managers for git, docker, sessions, agents, ports, and repositories
- **packages/cli** (`@viwo/cli`) - Commander.js CLI built on core

### Key Design Patterns

**No build required during development** - Core exports TypeScript source directly (`main: "./src/index.ts"`), Bun's native TS support handles it.

**Functional manager pattern** - Each manager (`packages/core/src/managers/`) exports functions and a namespace object:
- `git-manager.ts` - Worktree operations via simple-git
- `docker-manager.ts` - Container orchestration via dockerode
- `session-manager.ts` - Session CRUD via Drizzle ORM
- `agent-manager.ts` - AI agent initialization with automatic container lifecycle management (only Claude Code implemented)
- `repository-manager.ts` - Repository CRUD
- `port-manager.ts` - Port allocation via get-port

**Schema-first validation** - All inputs validated with Zod schemas in `packages/core/src/schemas.ts`

### Database

- **SQLite database** stored in app data directory: `{app-data-path}/sqlite.db`
  - macOS: `~/Library/Application Support/viwo/sqlite.db`
  - Windows: `%APPDATA%/viwo/sqlite.db`
  - Linux: `~/.local/share/viwo/sqlite.db`
- **Drizzle ORM** with schemas in `packages/core/src/db-schemas/`
- **Tables**: repositories, sessions, chats, configurations
- **Migrations** in `packages/core/src/migrations/` - applied automatically on startup via `initializeDatabase()`

### Core SDK Flow

The main SDK in `packages/core/src/viwo.ts` exposes:
- `createViwo()` - Factory function returning Viwo instance
- `init()` - Creates worktree session: validate repo → check Docker → generate branch → create worktree → copy env → init agent
- `cleanup()` - Removes session: stop containers → remove containers → remove worktree → update status

### Container Lifecycle Management

The `agent-manager.ts` implements automatic container cleanup:
- When a Claude Code container is started, a background monitor is set up via `monitorContainerCompletion()`
- The monitor uses Docker's `waitForContainer()` API to detect when the container exits
- Upon container exit, the monitor automatically:
  - Updates the session status to 'completed' (exit code 0) or 'error' (non-zero exit code)
  - Removes the container using `removeContainer()`
  - Logs the cleanup operation
- This ensures containers don't linger after the Claude Code process completes

### CLI Commands

Commands in `packages/cli/src/commands/`:
- `start` - Initialize new session with prompt and agent
- `list` - List all sessions in interactive mode (default) or table view (--table flag)
  - Interactive mode (`list-interactive.ts`): Keyboard-navigable list using @inquirer/prompts with session details and actions (cd to worktree, delete, go back)
  - Table view: Traditional CLI table output with --table flag
  - Interactive multiline prompt that supports pasting multiple lines
  - Press Enter on an empty line or Ctrl+D to finish entering prompt
  - Allows users to paste large blocks of text without triggering execution
- `get` - Get session details
- `cleanup` - Remove a specific session and its resources
- `clean` - Clean up all completed, errored, or stopped sessions (marks as 'cleaned' and removes worktrees)
- `repo` - Repository management (list, add, delete)

## Testing

Tests use Bun's native test runner (`bun:test`). Test files are in `__tests__` directories with `.test.ts` suffix.

Current test coverage focuses on:
- `git-manager.test.ts` - Branch name generation, repo validation
- `docker-manager.test.ts` - Docker daemon status
- `agent-manager.test.ts` - Claude Code agent initialization

## Key Dependencies

- **drizzle-orm** - SQLite ORM
- **simple-git** - Git operations
- **dockerode** - Docker API
- **zod** - Runtime validation
- **commander** - CLI framework
- **@inquirer/prompts** - Interactive CLI prompts with keyboard navigation
- **chalk/ora/cli-table3** - CLI UI

## Known Limitations

- Only Claude Code agent is implemented (Cline, Cursor throw "not yet implemented")
- Docker Compose support is incomplete
- Session storage uses in-memory Map alongside database (migration in progress)

## Instructions to Keep in Mind

- As you make changes to the codebase, come back to this file (CLAUDE.md) and make updates whenever a structure or flow is updated.
- Always follow DRY principles
- If your code changes renders a function or variable obsolete, make sure to remove it.
- Always follow existing coding patterns in the codebase. For example, if the code uses a request client like Axios, then stick to using the established agent rather than calling the native `fetch` API.
- Follow the 'less is more' paradigm where applicable. Strike a good balance between readability and succinctness of code.
- Prefer using a typed object for function arguments rather than a series of positional arguments.
- Use arrow functions over traditional functions.
